import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { redirect } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/env';
import { auth, migrateAuth } from '#lib/server/auth.ts';
import { registerPipeline } from '#lib/server/agent/pipeline.ts';
import { recoverQueue } from '#lib/server/applications/queue.ts';
import { closeAll, resetUserActivity } from '#lib/server/browser/service.ts';
import { installShutdown, onShutdown } from '#lib/server/lifecycle.ts';
import { config } from '#lib/server/env.ts';
import { apiError } from '#lib/server/http.ts';
import { backfillApplyTypes } from '#lib/server/jobs/backfill.ts';
import { failOrphanRuns } from '#lib/server/jobs/search.ts';

export const init: ServerInit = async () => {
	if (building) return;
	await migrateAuth();
	registerPipeline();
	// The dev server re-runs init on reload; recovery must happen once per process,
	// or an application already running would be started a second time.
	const once = globalThis as { __wokBooted?: boolean };
	if (once.__wokBooted) return;
	once.__wokBooted = true;
	failOrphanRuns();
	resetUserActivity();
	// One-off, in the background: never holds the boot.
	void backfillApplyTypes().catch((err) => console.error('[backfill] applyType', err));
	recoverQueue();
	// Closing the contexts is what writes each user's browser profile to disk.
	onShutdown(closeAll);
	installShutdown();
};

const PUBLIC_PREFIXES = ['/login', '/api/auth', '/api/health', '/api/login-link'];

function isPublic(pathname: string) {
	return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export const handle: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);

	const session = await auth().api.getSession({ headers: event.request.headers });
	// A session opened before the address left AUTH_ALLOWED_EMAILS stops counting.
	const allowed = !!session && config.emailAllowed(session.user.email);
	event.locals.user = allowed ? session.user : null;
	event.locals.session = allowed ? session.session : null;

	const { pathname } = event.url;
	if (!event.locals.user && !isPublic(pathname)) {
		if (pathname.startsWith('/api/')) {
			return apiError(401, 'unauthorized', 'Sessão necessária.');
		}
		const next = pathname + event.url.search;
		redirect(303, next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`);
	}

	return svelteKitHandler({ event, resolve, auth: auth(), building });
};
