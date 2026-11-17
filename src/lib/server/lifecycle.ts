// Orderly exit. A deploy sends SIGTERM and kills the process a few seconds
// later; a killed Chromium can leave the user's persistent profile (their
// login cookies) corrupted, so everything that holds the process open is
// closed here and the process leaves by itself.

type Closer = () => void | Promise<void>;

const closers: Closer[] = [];
let stopping = false;

/** True from the moment the process was asked to stop: no new work, no status changes. */
export function isStopping() {
	return stopping;
}

export function onShutdown(closer: Closer) {
	closers.push(closer);
	return () => {
		const i = closers.indexOf(closer);
		if (i >= 0) closers.splice(i, 1);
	};
}

const HARD_LIMIT_MS = 6000;

async function shutdown(signal: string) {
	if (stopping) return;
	stopping = true;
	const started = Date.now();
	console.log(`[shutdown] ${signal}: closing streams and browsers`);
	// Whatever is still open past the limit is abandoned rather than waited for.
	setTimeout(() => {
		console.error('[shutdown] limit reached, leaving anyway');
		process.exit(0);
	}, HARD_LIMIT_MS).unref();
	await Promise.allSettled([...closers].map(async (close) => close()));
	console.log(`[shutdown] done in ${Date.now() - started} ms`);
	process.exit(0);
}

export function installShutdown() {
	process.on('SIGTERM', () => void shutdown('SIGTERM'));
	process.on('SIGINT', () => void shutdown('SIGINT'));
}
