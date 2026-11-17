import dns from 'node:dns/promises';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import { chromium, devices, type BrowserContext, type CDPSession, type Page } from 'playwright';
import { ApiError } from '../http.ts';
import { userDir } from '../latex.ts';

/**
 * One persistent Chromium profile per user, living in this process. The user
 * logs in to job sites through it from their phone; the applier agent then
 * drives the same context. Everyone watching gets the same JPEG screencast.
 */

export type Controller = 'agent' | 'user' | 'idle';

export interface Accounts {
	linkedin: boolean;
	glassdoor: boolean;
}

export interface BrowserState {
	open: boolean;
	controller: Controller;
	applicationId: string | null;
	url: string | null;
	title: string | null;
	viewport: { width: number; height: number };
	accounts: Accounts;
}

export interface Frame {
	/** Base64 JPEG. */
	jpeg: string;
	width: number;
	height: number;
}

export type BrowserEvent = { type: 'frame'; frame: Frame } | { type: 'state'; state: BrowserState };

export type UserInput =
	| { type: 'tap'; x: number; y: number }
	| { type: 'type'; text: string }
	| { type: 'key'; key: string }
	| { type: 'scroll'; deltaY: number; x?: number; y?: number }
	| { type: 'back' }
	| { type: 'reload' };

const DEVICE = devices['Pixel 7'];
const VIEWPORT = DEVICE.viewport;
const IDLE_CLOSE_MS = 10 * 60_000;
const NAV_TIMEOUT_MS = 45_000;

interface Session {
	userId: string;
	context: BrowserContext;
	page: Page;
	cdp: CDPSession | null;
	lastFrame: Frame | null;
	controller: Controller;
	applicationId: string | null;
	lastActivity: number;
	idleTimer: ReturnType<typeof setInterval>;
}

const sessions = new Map<string, Session>();
const opening = new Map<string, Promise<Session>>();
const viewers = new Map<string, number>();
const bus = new EventEmitter();
bus.setMaxListeners(0);

// ---------------------------------------------------------------- network guard

function isPrivateAddress(address: string) {
	if (net.isIPv4(address)) {
		const [a, b] = address.split('.').map(Number);
		return (
			a === 0 ||
			a === 10 ||
			a === 127 ||
			(a === 100 && b >= 64 && b <= 127) ||
			(a === 169 && b === 254) ||
			(a === 172 && b >= 16 && b <= 31) ||
			(a === 192 && b === 168) ||
			a >= 224
		);
	}
	const v6 = address.toLowerCase();
	if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7));
	return v6 === '::' || v6 === '::1' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6);
}

const hostVerdicts = new Map<string, { allowed: boolean; at: number }>();

/**
 * The browser runs on the production host, so pages (and the agent) must not
 * reach loopback or private addresses: that is where this app and its
 * neighbours listen.
 */
async function hostAllowed(hostname: string) {
	const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
	const cached = hostVerdicts.get(host);
	if (cached && Date.now() - cached.at < 5 * 60_000) return cached.allowed;
	let allowed: boolean;
	if (net.isIP(host)) allowed = !isPrivateAddress(host);
	else if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
		allowed = false;
	} else {
		try {
			const addresses = await dns.lookup(host, { all: true });
			allowed = addresses.length > 0 && !addresses.some((a) => isPrivateAddress(a.address));
		} catch {
			allowed = false;
		}
	}
	hostVerdicts.set(host, { allowed, at: Date.now() });
	return allowed;
}

export async function assertPublicUrl(raw: string): Promise<string> {
	let url: URL;
	try {
		url = new URL(raw.includes('://') ? raw : `https://${raw}`);
	} catch {
		throw new ApiError(400, 'invalid_url', 'URL inválida.');
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') {
		throw new ApiError(400, 'invalid_url', 'Só são aceitas URLs http(s).');
	}
	if (!(await hostAllowed(url.hostname))) {
		throw new ApiError(400, 'url_not_allowed', 'Este endereço não pode ser aberto.');
	}
	return url.toString();
}

// ---------------------------------------------------------------- accounts

function accountsFile(userId: string) {
	return userDir(userId, 'browser-accounts.json');
}

function readAccounts(userId: string): Accounts {
	try {
		return JSON.parse(fs.readFileSync(accountsFile(userId), 'utf8')) as Accounts;
	} catch {
		return { linkedin: false, glassdoor: false };
	}
}

/**
 * "Connected" means the site's login cookie is in the profile: `li_at` for
 * LinkedIn, and for Glassdoor its auth-token cookies. It is a hint for the
 * UI, not proof that the session is still accepted by the site.
 */
async function detectAccounts(session: Session): Promise<Accounts> {
	const cookies = await session.context
		.cookies([
			'https://www.linkedin.com',
			'https://www.glassdoor.com',
			'https://www.glassdoor.com.br'
		])
		.catch(() => []);
	const now = Date.now() / 1000;
	const live = cookies.filter((c) => c.value && (c.expires === -1 || c.expires > now));
	const accounts = {
		linkedin: live.some((c) => c.domain.includes('linkedin.com') && c.name === 'li_at'),
		glassdoor: live.some(
			(c) => c.domain.includes('glassdoor.') && ['at', 'rt', 'GSESSIONID_AUTH'].includes(c.name)
		)
	};
	try {
		fs.mkdirSync(userDir(session.userId), { recursive: true });
		fs.writeFileSync(accountsFile(session.userId), JSON.stringify(accounts));
	} catch {
		// the hint is best-effort
	}
	return accounts;
}

// ---------------------------------------------------------------- session lifecycle

function emit(userId: string, event: BrowserEvent) {
	bus.emit(userId, event);
}

async function buildState(userId: string): Promise<BrowserState> {
	const session = sessions.get(userId);
	if (!session) {
		return {
			open: false,
			controller: 'idle',
			applicationId: null,
			url: null,
			title: null,
			viewport: VIEWPORT,
			accounts: readAccounts(userId)
		};
	}
	return {
		open: true,
		controller: session.controller,
		applicationId: session.applicationId,
		url: session.page.url(),
		title: await session.page.title().catch(() => null),
		viewport: VIEWPORT,
		accounts: await detectAccounts(session)
	};
}

export const getState = buildState;

async function publishState(userId: string) {
	emit(userId, { type: 'state', state: await buildState(userId) });
}

async function attachScreencast(session: Session, page: Page) {
	if (session.cdp) await session.cdp.detach().catch(() => {});
	session.page = page;
	session.cdp = null;
	const cdp = await session.context.newCDPSession(page);
	session.cdp = cdp;
	cdp.on('Page.screencastFrame', (event) => {
		cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {});
		if (session.cdp !== cdp) return;
		session.lastFrame = {
			jpeg: event.data,
			width: event.metadata.deviceWidth,
			height: event.metadata.deviceHeight
		};
		emit(session.userId, { type: 'frame', frame: session.lastFrame });
	});
	await cdp.send('Page.startScreencast', {
		format: 'jpeg',
		quality: 55,
		maxWidth: VIEWPORT.width * 2,
		maxHeight: VIEWPORT.height * 2
	});
}

function watchPage(session: Session, page: Page) {
	page.setDefaultTimeout(15_000);
	page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
	page.on('framenavigated', (frame) => {
		if (frame === page.mainFrame() && session.page === page) void publishState(session.userId);
	});
	page.on('close', () => {
		if (session.page !== page || !sessions.has(session.userId)) return;
		const remaining = session.context.pages().filter((p) => !p.isClosed());
		const next = remaining.at(-1);
		if (next) void attachScreencast(session, next).then(() => publishState(session.userId));
	});
}

async function launch(userId: string): Promise<Session> {
	const context = await chromium.launchPersistentContext(userDir(userId, 'browser-profile'), {
		headless: true,
		...DEVICE,
		locale: 'pt-BR',
		timezoneId: 'America/Sao_Paulo',
		acceptDownloads: false
	});
	await context.route('**/*', async (route) => {
		const url = new URL(route.request().url());
		if (
			(url.protocol === 'http:' || url.protocol === 'https:') &&
			!(await hostAllowed(url.hostname))
		) {
			return route.abort('blockedbyclient');
		}
		return route.continue();
	});

	const page = context.pages()[0] ?? (await context.newPage());
	const session: Session = {
		userId,
		context,
		page,
		cdp: null,
		lastFrame: null,
		controller: 'idle',
		applicationId: null,
		lastActivity: Date.now(),
		idleTimer: setInterval(() => {
			const idleFor = Date.now() - session.lastActivity;
			if (session.controller !== 'agent' && !viewers.get(userId) && idleFor > IDLE_CLOSE_MS) {
				void closeSession(userId);
			}
		}, 60_000)
	};
	watchPage(session, page);
	// A link that opens a new tab becomes the page everyone sees and drives.
	context.on('page', (opened) => {
		watchPage(session, opened);
		void attachScreencast(session, opened).then(() => publishState(userId));
	});
	context.on('close', () => {
		if (sessions.get(userId) === session) {
			sessions.delete(userId);
			clearInterval(session.idleTimer);
			void publishState(userId);
		}
	});
	await attachScreencast(session, page);
	sessions.set(userId, session);
	return session;
}

async function ensure(userId: string): Promise<Session> {
	const existing = sessions.get(userId);
	if (existing) {
		existing.lastActivity = Date.now();
		return existing;
	}
	let pending = opening.get(userId);
	if (!pending) {
		pending = launch(userId).finally(() => opening.delete(userId));
		opening.set(userId, pending);
	}
	return pending;
}

async function closeSession(userId: string) {
	const session = sessions.get(userId);
	if (!session) return;
	await detectAccounts(session);
	sessions.delete(userId);
	clearInterval(session.idleTimer);
	await session.context.close().catch(() => {});
	await publishState(userId);
}

export async function closeAll() {
	await Promise.all([...sessions.keys()].map((id) => closeSession(id)));
}

// ---------------------------------------------------------------- viewers

/** Read-only spectators. Any number per user; each gets the last frame at once. */
export function watch(userId: string, listener: (event: BrowserEvent) => void) {
	viewers.set(userId, (viewers.get(userId) ?? 0) + 1);
	bus.on(userId, listener);
	const session = sessions.get(userId);
	if (session) {
		session.lastActivity = Date.now();
		if (session.lastFrame) listener({ type: 'frame', frame: session.lastFrame });
	}
	void buildState(userId).then((state) => listener({ type: 'state', state }));
	return () => {
		bus.off(userId, listener);
		const left = (viewers.get(userId) ?? 1) - 1;
		if (left > 0) viewers.set(userId, left);
		else viewers.delete(userId);
	};
}

// ---------------------------------------------------------------- user control

function assertUserControl(session: Session | undefined) {
	if (session?.controller === 'agent') {
		throw new ApiError(409, 'agent_in_control', 'O agente está usando o browser agora.');
	}
}

/** Opens a URL for the user ("connect accounts"), taking control if the browser was idle. */
export async function openForUser(userId: string, rawUrl: string): Promise<BrowserState> {
	assertUserControl(sessions.get(userId));
	const url = await assertPublicUrl(rawUrl);
	const session = await ensure(userId);
	assertUserControl(session);
	session.controller = 'user';
	await session.page.goto(url, { waitUntil: 'domcontentloaded' }).catch((err) => {
		throw new ApiError(
			502,
			'navigation_failed',
			`Não foi possível abrir a página: ${firstLine(err)}`
		);
	});
	const state = await buildState(userId);
	emit(userId, { type: 'state', state });
	return state;
}

export async function userInput(userId: string, input: UserInput): Promise<BrowserState> {
	const session = sessions.get(userId);
	if (!session) throw new ApiError(409, 'browser_closed', 'O browser não está aberto.');
	if (session.controller !== 'user') {
		throw new ApiError(
			409,
			session.controller === 'agent' ? 'agent_in_control' : 'not_in_control',
			session.controller === 'agent'
				? 'O agente está usando o browser agora.'
				: 'Abra uma página antes de interagir.'
		);
	}
	session.lastActivity = Date.now();
	const page = session.page;
	try {
		switch (input.type) {
			case 'tap':
				await page.touchscreen.tap(input.x, input.y);
				break;
			case 'type':
				await page.keyboard.type(input.text, { delay: 15 });
				break;
			case 'key':
				await page.keyboard.press(input.key);
				break;
			case 'scroll':
				await page.mouse.move(input.x ?? VIEWPORT.width / 2, input.y ?? VIEWPORT.height / 2);
				await page.mouse.wheel(0, input.deltaY);
				break;
			case 'back':
				await page.goBack({ waitUntil: 'domcontentloaded' });
				break;
			case 'reload':
				await page.reload({ waitUntil: 'domcontentloaded' });
				break;
		}
	} catch (err) {
		throw new ApiError(422, 'input_failed', `Ação não pôde ser executada: ${firstLine(err)}`);
	}
	return buildState(userId);
}

export async function closeForUser(userId: string): Promise<BrowserState> {
	assertUserControl(sessions.get(userId));
	await closeSession(userId);
	return buildState(userId);
}

// ---------------------------------------------------------------- agent control

function firstLine(err: unknown) {
	return (err instanceof Error ? err.message : String(err)).split('\n')[0].slice(0, 300);
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** A person does not act every 50 ms; neither should an account we want to keep. */
const humanPause = () => pause(700 + Math.random() * 1300);

const SNAPSHOT_CHARS = 28_000;

/** What the applier agent can do. Every method acts on the page the user is watching. */
export interface AgentBrowser {
	url(): string;
	navigate(url: string): Promise<string>;
	snapshot(): Promise<string>;
	click(ref: string): Promise<string>;
	type(ref: string, text: string, submit?: boolean): Promise<string>;
	select(ref: string, option: string): Promise<string>;
	press(key: string): Promise<string>;
	scroll(direction: 'up' | 'down'): Promise<string>;
	upload(ref: string, filePath: string): Promise<string>;
	screenshot(): Promise<string>;
}

async function settle(page: Page) {
	await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
	await pause(600);
}

function agentBrowser(session: Session): AgentBrowser {
	const page = () => session.page;
	const locate = (ref: string) => page().locator(`aria-ref=${ref.replace(/[^a-zA-Z0-9]/g, '')}`);
	const where = async () =>
		`Página atual: ${page().url()} — "${await page()
			.title()
			.catch(() => '')}"`;
	return {
		url: () => page().url(),
		async navigate(raw) {
			const url = await assertPublicUrl(raw);
			await humanPause();
			await page().goto(url, { waitUntil: 'domcontentloaded' });
			await settle(page());
			return where();
		},
		async snapshot() {
			const text = await page().ariaSnapshot({ mode: 'ai' });
			const body =
				text.length > SNAPSHOT_CHARS
					? `${text.slice(0, SNAPSHOT_CHARS)}\n… (snapshot cortado: role a página para ver o resto)`
					: text;
			return `${await where()}\n\n${body}`;
		},
		async click(ref) {
			await humanPause();
			await locate(ref).click({ timeout: 10_000 });
			await settle(page());
			return `Cliquei em ${ref}. ${await where()}`;
		},
		async type(ref, text, submit) {
			await humanPause();
			const target = locate(ref);
			await target.fill('', { timeout: 10_000 });
			await target.pressSequentially(text, { delay: 35 + Math.random() * 50 });
			if (submit) {
				await target.press('Enter');
				await settle(page());
			}
			return `Preenchi ${ref}.`;
		},
		async select(ref, option) {
			await humanPause();
			const chosen = await locate(ref).selectOption({ label: option }, { timeout: 10_000 });
			return `Selecionei ${JSON.stringify(chosen)} em ${ref}.`;
		},
		async press(key) {
			await humanPause();
			await page().keyboard.press(key);
			await settle(page());
			return `Pressionei ${key}. ${await where()}`;
		},
		async scroll(direction) {
			await pause(300 + Math.random() * 400);
			await page().mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
			await page().mouse.wheel(
				0,
				direction === 'down' ? VIEWPORT.height * 0.8 : -VIEWPORT.height * 0.8
			);
			await pause(500);
			return `Rolei a página para ${direction === 'down' ? 'baixo' : 'cima'}.`;
		},
		async upload(ref, filePath) {
			await humanPause();
			const target = locate(ref);
			const isFileInput = await target
				.evaluate((el) => el instanceof HTMLInputElement && el.type === 'file')
				.catch(() => false);
			if (isFileInput) {
				await target.setInputFiles(filePath);
			} else {
				// Styled upload buttons open the native picker; answer it with the PDF.
				const [chooser] = await Promise.all([
					page().waitForEvent('filechooser', { timeout: 10_000 }),
					target.click()
				]);
				await chooser.setFiles(filePath);
			}
			await pause(1200);
			return `Enviei o PDF do currículo em ${ref}.`;
		},
		async screenshot() {
			const buffer = await page().screenshot({ type: 'jpeg', quality: 60 });
			return buffer.toString('base64');
		}
	};
}

/** Hands the user's browser to the agent for one application. */
export async function acquireForAgent(
	userId: string,
	applicationId: string
): Promise<AgentBrowser> {
	const session = await ensure(userId);
	session.controller = 'agent';
	session.applicationId = applicationId;
	await publishState(userId);
	return agentBrowser(session);
}

/**
 * Ends the agent's turn. `user` leaves the page open and controllable (the
 * application is waiting for the person); `idle` just lets go.
 */
export async function releaseFromAgent(
	userId: string,
	to: 'user' | 'idle',
	keepApplication = false
) {
	const session = sessions.get(userId);
	if (!session) return;
	session.controller = to;
	if (!keepApplication) session.applicationId = null;
	session.lastActivity = Date.now();
	await publishState(userId);
}

/** Lets the user act on the page a paused application left open. */
export async function takeControl(userId: string): Promise<BrowserState> {
	const session = await ensure(userId);
	assertUserControl(session);
	session.controller = 'user';
	const state = await buildState(userId);
	emit(userId, { type: 'state', state });
	return state;
}
