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
	/** When on, the applier fills everything but never presses the final submit. */
	get applyDryRun() {
		return ['1', 'true', 'yes'].includes((privateEnv.APPLY_DRY_RUN || '').toLowerCase());
	},
	get isProduction() {
		return privateEnv.NODE_ENV === 'production';
	}
};

export function envVar(name: string) {
	return privateEnv[name] || '';
}
