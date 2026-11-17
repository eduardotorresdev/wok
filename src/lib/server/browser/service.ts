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
/** Paused applications keep their tab open longer, so the person has time to come back. */
const IDLE_CLOSE_PAUSED_MS = 45 * 60_000;
/** Tab of the "connect accounts" flow; every other tab belongs to one application. */
const USER_TAB = 'user';
const NAV_TIMEOUT_MS = 45_000;

interface Tab {
	key: string;
	/** The page being shown; a popup opened from it replaces it until closed. */
	page: Page;
	stack: Page[];
	cdp: CDPSession | null;
	lastFrame: Frame | null;
	controller: Controller;
}

interface Session {
	userId: string;
	context: BrowserContext;
	/** One tab per application, plus USER_TAB. A paused application keeps its tab untouched. */
	tabs: Map<string, Tab>;
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

/** Which tab a request without applicationId means: accounts tab, else the one the agent drives. */
function defaultTab(session: Session): Tab | undefined {
	const tabs = [...session.tabs.values()];
	return session.tabs.get(USER_TAB) ?? tabs.find((t) => t.controller === 'agent') ?? tabs.at(-1);
}

function resolveTab(session: Session | undefined, applicationId?: string | null) {
	if (!session) return undefined;
	return applicationId ? session.tabs.get(applicationId) : defaultTab(session);
}

function emit(userId: string, key: string, event: BrowserEvent) {
	bus.emit(`${userId}:${key}`, event);
	const session = sessions.get(userId);
	// Viewers that did not name an application follow the default tab.
	if (!session || defaultTab(session)?.key === key) bus.emit(`${userId}:*`, event);
}

async function tabState(session: Session, tab: Tab): Promise<BrowserState> {
	return {
		open: true,
		controller: tab.controller,
		applicationId: tab.key === USER_TAB ? null : tab.key,
		url: tab.page.url(),
		title: await tab.page.title().catch(() => null),
		viewport: VIEWPORT,
		accounts: await detectAccounts(session)
	};
}

function closedState(userId: string, applicationId?: string | null): BrowserState {
	return {
		open: false,
		controller: 'idle',
		applicationId: applicationId ?? null,
		url: null,
		title: null,
		viewport: VIEWPORT,
		accounts: readAccounts(userId)
	};
}

/** State of one application's tab, or of the default tab when no application is named. */
export async function getState(
	userId: string,
	applicationId?: string | null
): Promise<BrowserState> {
	const session = sessions.get(userId);
	const tab = resolveTab(session, applicationId);
	if (!session || !tab) {
		const closed = closedState(userId, applicationId);
		if (session) closed.accounts = await detectAccounts(session);
		return closed;
	}
	return tabState(session, tab);
}

async function publishState(session: Session, tab: Tab) {
	if (!session.tabs.has(tab.key)) return;
	emit(session.userId, tab.key, { type: 'state', state: await tabState(session, tab) });
}

async function attachScreencast(session: Session, tab: Tab, page: Page) {
	if (tab.cdp) await tab.cdp.detach().catch(() => {});
	tab.page = page;
	tab.cdp = null;
	const cdp = await session.context.newCDPSession(page);
	tab.cdp = cdp;
	cdp.on('Page.screencastFrame', (event) => {
		cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {});
		if (tab.cdp !== cdp) return;
		tab.lastFrame = {
			jpeg: event.data,
			width: event.metadata.deviceWidth,
			height: event.metadata.deviceHeight
		};
		emit(session.userId, tab.key, { type: 'frame', frame: tab.lastFrame });
	});
	await cdp.send('Page.startScreencast', {
		format: 'jpeg',
		quality: 55,
		maxWidth: VIEWPORT.width * 2,
		maxHeight: VIEWPORT.height * 2
	});
}

function watchPage(session: Session, tab: Tab, page: Page) {
	page.setDefaultTimeout(15_000);
	page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
	page.on('framenavigated', (frame) => {
		if (frame === page.mainFrame() && tab.page === page) void publishState(session, tab);
	});
	page.on('close', () => {
		tab.stack = tab.stack.filter((p) => p !== page);
		if (tab.page !== page || !session.tabs.has(tab.key)) return;
		const previous = tab.stack.at(-1);
		if (previous) {
			void attachScreencast(session, tab, previous).then(() => publishState(session, tab));
		} else {
			session.tabs.delete(tab.key);
			emit(session.userId, tab.key, {
				type: 'state',
				state: closedState(session.userId, tab.key === USER_TAB ? null : tab.key)
			});
		}
	});
}

async function openTab(session: Session, key: string): Promise<Tab> {
	const existing = session.tabs.get(key);
	if (existing) return existing;
	// The persistent context starts with one blank page; the first tab takes it.
	const used = new Set([...session.tabs.values()].flatMap((t) => t.stack));
	const spare = session.context.pages().find((p) => !p.isClosed() && !used.has(p));
	const page = spare ?? (await session.context.newPage());
	const tab: Tab = { key, page, stack: [page], cdp: null, lastFrame: null, controller: 'idle' };
	session.tabs.set(key, tab);
	watchPage(session, tab, page);
	await attachScreencast(session, tab, page);
	return tab;
}

async function closeTab(session: Session, key: string) {
	const tab = session.tabs.get(key);
	if (!tab) return;
	session.tabs.delete(key);
	if (tab.cdp) await tab.cdp.detach().catch(() => {});
	// Keep one page alive so the context itself stays open for the next tab.
	const others = session.context.pages().filter((p) => !p.isClosed() && !tab.stack.includes(p));
	if (!others.length) await session.context.newPage().catch(() => {});
	for (const page of tab.stack) await page.close().catch(() => {});
	emit(session.userId, key, {
		type: 'state',
		state: closedState(session.userId, key === USER_TAB ? null : key)
	});
}

async function launch(userId: string): Promise<Session> {
	// Same device, language and time zone on every launch: a profile that keeps
	// changing its fingerprint is what earns extra verification challenges.
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

	const session: Session = {
		userId,
		context,
		tabs: new Map(),
		lastActivity: Date.now(),
		idleTimer: setInterval(() => {
			const tabs = [...session.tabs.values()];
			if (tabs.some((t) => t.controller === 'agent') || viewers.get(userId)) return;
			const paused = tabs.some((t) => t.key !== USER_TAB);
			const limit = paused ? IDLE_CLOSE_PAUSED_MS : IDLE_CLOSE_MS;
			if (Date.now() - session.lastActivity > limit) void closeSession(userId);
		}, 60_000)
	};
	// A link that opens a new window takes over the tab it was opened from.
	context.on('page', (opened) => {
		void opened.opener().then((opener) => {
			if (!opener) return;
			const tab = [...session.tabs.values()].find((t) => t.stack.includes(opener));
			if (!tab) return;
			tab.stack.push(opened);
			watchPage(session, tab, opened);
			void attachScreencast(session, tab, opened).then(() => publishState(session, tab));
		});
	});
	context.on('close', () => {
		if (sessions.get(userId) !== session) return;
		sessions.delete(userId);
		clearInterval(session.idleTimer);
		for (const key of session.tabs.keys()) {
			emit(userId, key, {
				type: 'state',
				state: closedState(userId, key === USER_TAB ? null : key)
			});
		}
	});
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
	const keys = [...session.tabs.keys()];
	sessions.delete(userId);
	clearInterval(session.idleTimer);
	await session.context.close().catch(() => {});
	for (const key of keys) {
		emit(userId, key, { type: 'state', state: closedState(userId, key === USER_TAB ? null : key) });
	}
}

export async function closeAll() {
	await Promise.all([...sessions.keys()].map((id) => closeSession(id)));
}

// ---------------------------------------------------------------- rehydration

/**
 * Tabs live in memory, so a restart or an idle close leaves a paused
 * application without one. The application layer tells us where such an
 * application stopped; the tab is then rebuilt on demand from the user's
 * persistent profile (cookies and storage survive on disk).
 */
export interface PausedTab {
	url: string;
}

let pausedLookup: ((userId: string, applicationId: string) => PausedTab | null) | undefined;
let onRehydrated: ((userId: string, applicationId: string) => void) | undefined;

export function setPausedTabSource(
	lookup: (userId: string, applicationId: string) => PausedTab | null,
	rehydrated: (userId: string, applicationId: string) => void
) {
	pausedLookup = lookup;
	onRehydrated = rehydrated;
}

const rehydrating = new Map<string, Promise<Tab | undefined>>();

/** The application's tab, reopened at the page where it paused when it is gone. */
function tabFor(userId: string, applicationId: string): Promise<Tab | undefined> {
	const live = sessions.get(userId)?.tabs.get(applicationId);
	if (live) return Promise.resolve(live);
	const paused = pausedLookup?.(userId, applicationId);
	if (!paused) return Promise.resolve(undefined);
	const key = `${userId}:${applicationId}`;
	let task = rehydrating.get(key);
	if (!task) {
		task = (async () => {
			const session = await ensure(userId);
			const tab = await openTab(session, applicationId);
			tab.controller = 'user';
			const url = await assertPublicUrl(paused.url).catch(() => null);
			if (url) await tab.page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
			await publishState(session, tab);
			onRehydrated?.(userId, applicationId);
			return tab;
		})().finally(() => rehydrating.delete(key));
		rehydrating.set(key, task);
	}
	return task;
}

// ---------------------------------------------------------------- viewers

/**
 * Read-only spectators. Any number per user; each gets the last frame at once.
 * With an applicationId the viewer follows that application's tab; without
 * one, the default tab.
 */
export function watch(
	userId: string,
	applicationId: string | null,
	listener: (event: BrowserEvent) => void
) {
	const channel = `${userId}:${applicationId ?? '*'}`;
	viewers.set(userId, (viewers.get(userId) ?? 0) + 1);
	bus.on(channel, listener);
	const session = sessions.get(userId);
	const tab = resolveTab(session, applicationId);
	if (session) session.lastActivity = Date.now();
	if (tab?.lastFrame) listener({ type: 'frame', frame: tab.lastFrame });
	if (applicationId && !tab) {
		// Opening the viewer of a paused application brings its tab back; frames and
		// state then arrive through the channel this listener is already on.
		void tabFor(userId, applicationId)
			.then(() => getState(userId, applicationId))
			.then((state) => listener({ type: 'state', state }))
			.catch(() => {});
	} else {
		void getState(userId, applicationId).then((state) => listener({ type: 'state', state }));
	}
	return () => {
		bus.off(channel, listener);
		const left = (viewers.get(userId) ?? 1) - 1;
		if (left > 0) viewers.set(userId, left);
		else viewers.delete(userId);
	};
}

// ---------------------------------------------------------------- user control

function assertNotAgent(tab: Tab | undefined) {
	if (tab?.controller === 'agent') {
		throw new ApiError(409, 'agent_in_control', 'O agente está usando esta aba agora.');
	}
}

/**
 * Opens a URL for the user. Without applicationId it uses the accounts tab
 * ("connect accounts"); with one, the tab of that paused application.
 */
export async function openForUser(
	userId: string,
	rawUrl: string,
	applicationId?: string | null
): Promise<BrowserState> {
	const url = await assertPublicUrl(rawUrl);
	const session = await ensure(userId);
	const tab = await openTab(session, applicationId ?? USER_TAB);
	assertNotAgent(tab);
	tab.controller = 'user';
	await tab.page.goto(url, { waitUntil: 'domcontentloaded' }).catch((err) => {
		throw new ApiError(
			502,
			'navigation_failed',
			`Não foi possível abrir a página: ${firstLine(err)}`
		);
	});
	const state = await tabState(session, tab);
	emit(userId, tab.key, { type: 'state', state });
	return state;
}

/** Lets the user act on a tab that is already open (the page a paused application left). */
export async function takeControl(
	userId: string,
	applicationId?: string | null
): Promise<BrowserState> {
	const tab = applicationId
		? await tabFor(userId, applicationId)
		: resolveTab(sessions.get(userId), null);
	const session = sessions.get(userId);
	if (!session || !tab) throw new ApiError(409, 'browser_closed', 'Esta aba não está aberta.');
	assertNotAgent(tab);
	tab.controller = 'user';
	session.lastActivity = Date.now();
	const state = await tabState(session, tab);
	emit(userId, tab.key, { type: 'state', state });
	return state;
}

export async function userInput(
	userId: string,
	input: UserInput,
	applicationId?: string | null
): Promise<BrowserState> {
	const tab = applicationId
		? await tabFor(userId, applicationId)
		: resolveTab(sessions.get(userId), null);
	const session = sessions.get(userId);
	if (!session || !tab) throw new ApiError(409, 'browser_closed', 'Esta aba não está aberta.');
	if (tab.controller !== 'user') {
		throw new ApiError(
			409,
			tab.controller === 'agent' ? 'agent_in_control' : 'not_in_control',
			tab.controller === 'agent'
				? 'O agente está usando esta aba agora.'
				: 'Abra uma página antes de interagir.'
		);
	}
	session.lastActivity = Date.now();
	const page = tab.page;
	// Chromium only delivers input to the page in front.
	await page.bringToFront().catch(() => {});
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
	return tabState(session, tab);
}

/** Closes the accounts tab (or one application's tab); the browser itself closes when idle. */
export async function closeForUser(
	userId: string,
	applicationId?: string | null
): Promise<BrowserState> {
	const session = sessions.get(userId);
	const key = applicationId ?? USER_TAB;
	if (session) {
		assertNotAgent(session.tabs.get(key));
		await detectAccounts(session);
		await closeTab(session, key);
		if (!session.tabs.size) await closeSession(userId);
	}
	return getState(userId, applicationId);
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
	/** Visible name of an element (text, aria-label or value), for checks before acting on it. */
	label(ref: string): Promise<string>;
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

function agentBrowser(tab: Tab): AgentBrowser {
	const page = () => tab.page;
	const locate = (ref: string) => page().locator(`aria-ref=${ref.replace(/[^a-zA-Z0-9]/g, '')}`);
	const where = async () =>
		`Página atual: ${page().url()} — "${await page()
			.title()
			.catch(() => '')}"`;
	return {
		url: () => page().url(),
		async label(ref) {
			return locate(ref)
				.evaluate((el) => {
					const input = el as HTMLInputElement;
					return [el.getAttribute('aria-label'), (el as HTMLElement).innerText, input.value]
						.filter(Boolean)
						.join(' ');
				})
				.catch(() => '');
		},
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
/** Gives the agent the tab of one application, opening it when it does not exist yet. */
export async function acquireForAgent(
	userId: string,
	applicationId: string
): Promise<AgentBrowser> {
	const session = await ensure(userId);
	const tab = await openTab(session, applicationId);
	tab.controller = 'agent';
	await tab.page.bringToFront().catch(() => {});
	await publishState(session, tab);
	return agentBrowser(tab);
}

/**
 * Ends the agent's turn on an application's tab. `user` leaves the page
 * exactly as it is and controllable (the application is waiting for the
 * person, and the agent moves on to the next one in another tab); `close`
 * discards the tab of a finished application.
 */
export async function releaseFromAgent(
	userId: string,
	applicationId: string,
	to: 'user' | 'close'
) {
	const session = sessions.get(userId);
	const tab = session?.tabs.get(applicationId);
	if (!session || !tab) return;
	session.lastActivity = Date.now();
	if (to === 'close') return closeTab(session, applicationId);
	tab.controller = 'user';
	await publishState(session, tab);
}

// ---------------------------------------------------------------- barrier watch

const BLOCKED_URL =
	/authwall|checkpoint|challenge|captcha|\/login|\/signin|sign-in|\/uas\/|\/verify|verification|\/sso\b|accounts\.google\.com/i;
const BLOCKED_TITLE =
	/just a moment|um momento|somente humanos|humans only|attention required|security check|verifica[cç][aã]o de seguran[cç]a|access denied/i;

async function looksBlocked(page: Page) {
	if (BLOCKED_URL.test(page.url())) return true;
	return BLOCKED_TITLE.test(await page.title().catch(() => ''));
}

/**
 * Watches the tab of an application paused at a login or verification screen
 * and calls `onCleared` once the person got past it (the page left the
 * barrier and stayed out for a few seconds). Nothing here acts on the page:
 * it only notices that the human finished. Returns a function that stops it.
 */
export function watchBarrier(userId: string, applicationId: string, onCleared: () => void) {
	let clearStreak = 0;
	let armed = false;
	const timer = setInterval(async () => {
		const tab = sessions.get(userId)?.tabs.get(applicationId);
		if (!tab || tab.controller !== 'user' || tab.page.isClosed()) return stop();
		const blocked = await looksBlocked(tab.page);
		// Only a pause that started on a recognizable barrier can be auto-resumed.
		if (!armed) {
			if (!blocked) return stop();
			armed = true;
			return;
		}
		clearStreak = blocked ? 0 : clearStreak + 1;
		if (clearStreak >= 3) {
			stop();
			onCleared();
		}
	}, 2000);
	const stop = () => clearInterval(timer);
	return stop;
}
