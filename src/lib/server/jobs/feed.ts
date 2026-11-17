import { and, count, eq, isNotNull, notExists, sql } from 'drizzle-orm';
import { connectedAccounts } from '../browser/service.ts';
import { db, schema } from '../db/index.ts';
import { config } from '../env.ts';

export interface JobDto {
	id: string;
	title: string;
	company: string;
	companyLogo: string | null;
	location: string | null;
	source: 'linkedin' | 'glassdoor';
	url: string;
	/** Application form on the company's own site, when the posting has one. */
	applyUrl: string | null;
	/** Where the application goes through: the company's site, or the job board's own flow. */
	applyVia: 'company' | 'linkedin' | 'glassdoor';
	/** False when applying needs an account that is not connected; see blockedBy. */
	canApply: boolean;
	blockedBy: 'linkedin' | 'glassdoor' | null;
	salary: string | null;
	postedAt: string | null;
	summary: string | null;
	matchScore: number | null;
	matchReasons: string[];
}

export function applyVia(row: { source: 'linkedin' | 'glassdoor'; applyUrl: string | null }) {
	return row.applyUrl ? 'company' : row.source;
}

type Connected = { linkedin: boolean; glassdoor: boolean };

/**
 * The account an application to this job needs and the person has not
 * connected. The company's own form needs none; Glassdoor in manual mode
 * needs none either, since the person applies there by themselves.
 */
export function blockedBy(
	row: { source: 'linkedin' | 'glassdoor'; applyUrl: string | null },
	accounts: Connected
): 'linkedin' | 'glassdoor' | null {
	const via = applyVia(row);
	if (via === 'linkedin') return accounts.linkedin ? null : 'linkedin';
	if (via === 'glassdoor' && config.glassdoorApply === 'auto') {
		return accounts.glassdoor ? null : 'glassdoor';
	}
	return null;
}

export function jobDto(row: typeof schema.job.$inferSelect, accounts?: Connected): JobDto {
	const blocked = accounts ? blockedBy(row, accounts) : null;
	return {
		id: row.id,
		title: row.title,
		company: row.company,
		companyLogo: row.companyLogo,
		location: row.location,
		source: row.source,
		url: row.url,
		applyUrl: row.applyUrl,
		applyVia: applyVia(row),
		canApply: !blocked,
		blockedBy: blocked,
		salary: row.salary,
		postedAt: row.postedAt,
		summary: row.summary,
		matchScore: row.matchScore,
		matchReasons: row.matchReasons ?? []
	};
}

function unswiped(userId: string) {
	return and(
		eq(schema.job.userId, userId),
		notExists(
			db()
				.select({ one: sql`1` })
				.from(schema.swipe)
				.where(and(eq(schema.swipe.userId, userId), eq(schema.swipe.jobId, schema.job.id)))
		)
	);
}

function searching(userId: string) {
	return !!db()
		.select({ id: schema.searchRun.id })
		.from(schema.searchRun)
		.where(and(eq(schema.searchRun.userId, userId), eq(schema.searchRun.status, 'running')))
		.get();
}

/**
 * Jobs not swiped yet, best match first. While a search is running only the
 * already-scored ones are returned, so a card never shows up without its score
 * and then jumps position; once it ends, anything left unscored goes last.
 */
export async function feed(userId: string, limit = 200): Promise<JobDto[]> {
	const accounts = await connectedAccounts(userId);
	const rows = db()
		.select()
		.from(schema.job)
		.where(
			searching(userId) ? and(unswiped(userId), isNotNull(schema.job.matchScore)) : unswiped(userId)
		)
		.orderBy(
			sql`${schema.job.matchScore} is null`,
			sql`${schema.job.matchScore} desc`,
			// Same score: Glassdoor's own flow stops at a human check, so it goes after the rest.
			sql`${schema.job.source} = 'glassdoor' and ${schema.job.applyUrl} is null`,
			sql`${schema.job.createdAt} desc`
		)
		.limit(limit)
		.all();
	return rows.map((row) => jobDto(row, accounts));
}

export function feedCount(userId: string) {
	return db().select({ n: count() }).from(schema.job).where(unswiped(userId)).get()?.n ?? 0;
}

export function getJob(userId: string, jobId: string) {
	return db()
		.select()
		.from(schema.job)
		.where(and(eq(schema.job.userId, userId), eq(schema.job.id, jobId)))
		.get();
}
