import { browser } from '$app/env';
import type {
	Application,
	BrowserInput,
	BrowserState,
	CompileResult,
	Job,
	Preferences,
	Profile,
	Resume,
	SavedAnswer,
	SearchRun,
	SwipeDirection
} from './types.ts';

export class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string
	) {
		super(message);
	}
}

/** Em dev, rotas que o Back-End ainda não publicou caem na fixture local. */
const NOT_BUILT_YET = new Set([404, 405, 501]);

/** Em dev, `?mock` na URL força as fixtures mesmo com a rota real no ar. */
let leaving = false;

/**
 * Um 401 só manda para o login depois de confirmar que a sessão acabou mesmo:
 * uma resposta isolada (deploy no meio, cookie ainda chegando) não derruba quem está logado.
 */
async function sessionLost() {
	if (leaving) return;
	leaving = true;
	try {
		const res = await fetch('/api/auth/get-session', { credentials: 'same-origin' });
		const session = res.ok ? await res.json().catch(() => null) : undefined;
		if (session !== null) return; // sessão válida, ou não deu para saber
		const here = location.pathname + location.search;
		location.assign(here === '/' ? '/login' : `/login?next=${encodeURIComponent(here)}`);
	} catch {
		// sem rede: fica onde está
	} finally {
		leaving = false;
	}
}

function forcedMock() {
	return browser && new URLSearchParams(location.search).has('mock');
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
	// import.meta.env.DEV é trocado por `false` no build: as fixtures nem entram no bundle.
	if (import.meta.env.DEV && forcedMock() && /^\/api\/(jobs|applications|browser)\b/.test(path)) {
		const { mock } = await import('./mock.ts');
		return mock(method, path, body) as Promise<T>;
	}

	const res = await fetch(path, {
		method,
		credentials: 'same-origin',
		headers: body === undefined ? undefined : { 'content-type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});

	if (res.ok) {
		if (res.status === 204) return undefined as T;
		const type = res.headers.get('content-type') ?? '';
		return type.includes('json') ? ((await res.json()) as T) : (undefined as T);
	}

	const payload = await res
		.clone()
		.json()
		.catch(() => null);
	const known = payload?.error as { code?: string; message?: string } | undefined;

	if (import.meta.env.DEV && NOT_BUILT_YET.has(res.status) && !known) {
		const { mock } = await import('./mock.ts');
		return mock(method, path, body) as Promise<T>;
	}

	if (res.status === 401 && typeof location !== 'undefined') void sessionLost();
	throw new ApiError(
		res.status,
		known?.code ?? 'http_error',
		known?.message ?? 'Algo deu errado. Tente de novo.'
	);
}

export const api = {
	resume: {
		get: () => call<Resume>('GET', '/api/resume'),
		save: (latex: string) => call<Resume>('PUT', '/api/resume', { latex }),
		compile: (latex?: string) =>
			call<CompileResult>('POST', '/api/resume/compile', latex === undefined ? {} : { latex })
	},
	preferences: {
		get: () => call<Preferences>('GET', '/api/preferences'),
		save: (prefs: Preferences) =>
			call<Preferences>('PUT', '/api/preferences', {
				terms: prefs.terms,
				locations: prefs.locations,
				remote: prefs.remote,
				area: prefs.area,
				seniority: prefs.seniority
			})
	},
	jobs: {
		feed: async () => {
			const data = await call<Job[] | { jobs: Job[] }>('GET', '/api/jobs/feed');
			return Array.isArray(data) ? data : (data?.jobs ?? []);
		},
		search: () => call<{ run: SearchRun }>('POST', '/api/jobs/search', {}),
		run: () => call<{ run: SearchRun | null }>('GET', '/api/jobs/search'),
		swipe: (id: string, direction: SwipeDirection) =>
			call<unknown>('POST', `/api/jobs/${encodeURIComponent(id)}/swipe`, { direction })
	},
	applications: {
		list: async () => {
			const data = await call<Application[] | { applications: Application[] }>(
				'GET',
				'/api/applications'
			);
			return Array.isArray(data) ? data : (data?.applications ?? []);
		},
		get: (id: string) => call<Application>('GET', `/api/applications/${encodeURIComponent(id)}`),
		answer: (id: string, answer: string) =>
			call<Application>('POST', `/api/applications/${encodeURIComponent(id)}/answer`, { answer }),
		resume: (id: string) =>
			call<Application>('POST', `/api/applications/${encodeURIComponent(id)}/resume`, {})
	},
	profile: {
		get: () => call<Profile>('GET', '/api/profile'),
		save: (profile: Profile) =>
			call<Profile>('PUT', '/api/profile', {
				...profile,
				updatedAt: undefined,
				// Linhas deixadas em branco nas listas não vão para o servidor.
				workAuthorization: profile.workAuthorization.filter((item) => item.country.trim()),
				languages: profile.languages.filter((item) => item.language.trim()),
				certifications: profile.certifications.filter((item) => item.name.trim())
			}),
		answers: () => call<SavedAnswer[]>('GET', '/api/profile/answers'),
		deleteAnswer: (id: string) =>
			call<SavedAnswer[]>('DELETE', `/api/profile/answers/${encodeURIComponent(id)}`)
	},
	browser: {
		state: () => call<BrowserState>('GET', '/api/browser/state'),
		/** Com url: abre e dá o controle ao usuário. Sem url: assume o controle da página atual. */
		open: (url?: string) => call<BrowserState>('POST', '/api/browser/open', url ? { url } : {}),
		input: (input: BrowserInput) => call<unknown>('POST', '/api/browser/input', input),
		close: () => call<BrowserState>('POST', '/api/browser/close', {})
	}
};
