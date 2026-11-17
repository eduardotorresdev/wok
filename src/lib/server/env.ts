import fs from 'node:fs';
import path from 'node:path';

// adapter-node does not read .env, and the agents/browser code needs the same
// values outside of request scope, so the process environment is the source of
// truth. A local .env only fills in what the environment does not define.
if (fs.existsSync('.env')) process.loadEnvFile('.env');
const privateEnv = process.env;

/** Server configuration, read lazily so the build never needs real secrets. */
export const config = {
	get dataDir() {
		return path.resolve(privateEnv.DATA_DIR || './data');
	},
	get baseUrl() {
		return (privateEnv.BETTER_AUTH_URL || privateEnv.ORIGIN || 'http://localhost:5173').replace(
			/\/$/,
			''
		);
	},
	get authSecret() {
		return privateEnv.BETTER_AUTH_SECRET || '';
	},
	get resendApiKey() {
		return privateEnv.RESEND_API_KEY || '';
	},
	get emailFrom() {
		return privateEnv.EMAIL_FROM || 'WOK <login@wok.eduardotorres.dev>';
	},
	get anthropicApiKey() {
		return privateEnv.ANTHROPIC_API_KEY || '';
	},
	get apifyToken() {
		return privateEnv.APIFY_TOKEN || '';
	},
	/** Postings older than this many days are not collected. */
	get jobsMaxAgeDays() {
		const days = Number(privateEnv.JOBS_MAX_AGE_DAYS);
		return Number.isFinite(days) && days >= 1 ? Math.floor(days) : 14;
	},
	/**
	 * Glassdoor's own application flow sits behind a human check that our
	 * browser does not get past. `manual` (default) tailors the résumé and hands
	 * the application to the person; `auto` lets the applier try the site.
	 */
	get glassdoorApply(): 'manual' | 'auto' {
		return (privateEnv.GLASSDOOR_APPLY || '').toLowerCase() === 'auto' ? 'auto' : 'manual';
	},
	/**
	 * Rehearsal mode: the applier fills everything but never presses the final
	 * submit. APPLY_DRY_RUN=1 turns it on for everyone (development);
	 * APPLY_DRY_RUN_EMAILS limits it to the listed accounts, so QA can rehearse
	 * in production while everyone else's applications are really sent.
	 */
	applyDryRunFor(email: string) {
		if (['1', 'true', 'yes'].includes((privateEnv.APPLY_DRY_RUN || '').toLowerCase())) return true;
		const listed = (privateEnv.APPLY_DRY_RUN_EMAILS || '')
			.split(',')
			.map((e) => e.trim().toLowerCase())
			.filter(Boolean);
		return !!email && listed.includes(email.trim().toLowerCase());
	},
	get isProduction() {
		return privateEnv.NODE_ENV === 'production';
	}
};

export function envVar(name: string) {
	return privateEnv[name] || '';
}
