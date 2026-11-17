// Calls that leave the machine (email, model, job boards) fail now and then for
// reasons that pass by themselves: a DNS hiccup, a dropped connection, a 5xx.
// Those get a few spaced attempts; an answer that says the request is wrong
// (4xx) never does.

export const RETRY_WAITS_MS = [500, 1500, 4000];

const NETWORK_CODES = new Set([
	'ECONNRESET',
	'ECONNREFUSED',
	'ECONNABORTED',
	'ENOTFOUND',
	'EAI_AGAIN',
	'ETIMEDOUT',
	'EPIPE',
	'EHOSTUNREACH',
	'ENETUNREACH',
	'UND_ERR_CONNECT_TIMEOUT',
	'UND_ERR_HEADERS_TIMEOUT',
	'UND_ERR_BODY_TIMEOUT',
	'UND_ERR_SOCKET'
]);
const NETWORK_NAMES = new Set([
	'APIConnectionError',
	'APIConnectionTimeoutError',
	'TimeoutError',
	'AbortError',
	'ConnectTimeoutError'
]);

/** Network, DNS, timeout or 5xx: worth trying again. A 4xx is not. */
export function isTransient(err: unknown, depth = 0): boolean {
	if (!err || typeof err !== 'object' || depth > 4) return false;
	const e = err as {
		status?: unknown;
		statusCode?: unknown;
		code?: unknown;
		name?: unknown;
		message?: unknown;
		cause?: unknown;
		constructor?: { name?: string };
	};
	const status = typeof e.status === 'number' ? e.status : e.statusCode;
	if (typeof status === 'number') return status >= 500;
	if (typeof e.code === 'string' && NETWORK_CODES.has(e.code)) return true;
	if (typeof e.name === 'string' && NETWORK_NAMES.has(e.name)) return true;
	if (e.constructor?.name && NETWORK_NAMES.has(e.constructor.name)) return true;
	if (typeof e.message === 'string' && /fetch failed|socket hang up|network error/i.test(e.message))
		return true;
	return isTransient(e.cause, depth + 1);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs `fn`, again after each wait while it fails for a passing reason. */
export async function withRetry<T>(
	label: string,
	fn: () => Promise<T>,
	options: { waits?: number[]; retryable?: (err: unknown) => boolean } = {}
): Promise<T> {
	const waits = options.waits ?? RETRY_WAITS_MS;
	const retryable = options.retryable ?? isTransient;
	for (let attempt = 0; ; attempt++) {
		try {
			return await fn();
		} catch (err) {
			if (attempt >= waits.length || !retryable(err)) throw err;
			const reason = err instanceof Error ? err.message.split('\n')[0] : String(err);
			console.warn(`[retry] ${label}: tentativa ${attempt + 1} falhou (${reason})`);
			await sleep(waits[attempt]);
		}
	}
}

/** `promise`, or a timeout error (retried like any other) after `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout>;
	const late = new Promise<never>((_, reject) => {
		timer = setTimeout(
			() =>
				reject(
					Object.assign(new Error(`${label}: sem resposta em ${ms} ms`), { name: 'TimeoutError' })
				),
			ms
		);
	});
	return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}
