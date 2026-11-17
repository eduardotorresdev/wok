import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { magicLink } from 'better-auth/plugins/magic-link';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { sqlite } from './db';
import { sendMagicLinkEmail } from './email';
import { config } from './env';

function createAuth() {
	return betterAuth({
		database: sqlite(),
		baseURL: config.baseUrl,
		secret: config.authSecret || undefined,
		trustedOrigins: [config.baseUrl],
		session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
		plugins: [
			magicLink({
				expiresIn: 60 * 15,
				sendMagicLink: async ({ email, url }) => {
					await sendMagicLinkEmail(email, url);
				}
			}),
			sveltekitCookies(getRequestEvent)
		]
	});
}

let instance: ReturnType<typeof createAuth> | undefined;

export function auth() {
	if (!instance) instance = createAuth();
	return instance;
}

/** Creates/updates Better Auth's own tables. Safe to run on every boot. */
export async function migrateAuth() {
	const { runMigrations } = await getMigrations(auth().options);
	await runMigrations();
}
