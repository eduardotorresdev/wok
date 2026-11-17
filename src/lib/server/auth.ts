import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { magicLink } from 'better-auth/plugins/magic-link';
import { APIError } from 'better-auth/api';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { sqlite } from './db';
import { EmailUnavailable, sendMagicLinkEmail } from './email';
import { config } from './env';

function createAuth() {
	return betterAuth({
		database: sqlite(),
		baseURL: config.baseUrl,
		secret: config.authSecret || undefined,
		trustedOrigins: [config.baseUrl],
		// Behind Cloudflare Tunnel the socket address is always the tunnel; without
		// this every visitor would share one rate-limit bucket.
		advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'] } },
		session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
		plugins: [
			magicLink({
				expiresIn: 60 * 15,
				sendMagicLink: async ({ email, url, token }) => {
					// Not on the list: answer exactly like a sent link, so the list is not revealed.
					if (!config.emailAllowed(email)) return;
					// Email the confirmation page, not the verify endpoint: see /api/login-link.
					const callback = new URL(url).searchParams.get('callbackURL') ?? '/';
					const link = new URL('/api/login-link', config.baseUrl);
					link.searchParams.set('token', token);
					link.searchParams.set('callbackURL', callback);
					try {
						await sendMagicLinkEmail(email, link.toString());
					} catch (err) {
						if (!(err instanceof EmailUnavailable)) throw err;
						// Every attempt failed to reach the email service: say so, plainly.
						throw new APIError('SERVICE_UNAVAILABLE', {
							code: 'EMAIL_UNAVAILABLE',
							message: 'Não consegui enviar o email agora. Tente de novo em instantes.'
						});
					}
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
