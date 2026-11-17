import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { redirect } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/env';
import { auth, migrateAuth } from '#lib/server/auth.ts';
import { apiError } from '#lib/server/http.ts';

export const init: ServerInit = async () => {
	if (building) return;
	await migrateAuth();
};

const PUBLIC_PREFIXES = ['/login', '/api/auth', '/api/health'];

function isPublic(pathname: string) {
	return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export const handle: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);

	const session = await auth().api.getSession({ headers: event.request.headers });
	event.locals.user = session?.user ?? null;
	event.locals.session = session?.session ?? null;

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
