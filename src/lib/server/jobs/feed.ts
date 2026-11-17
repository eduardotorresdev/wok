import { and, count, eq, isNotNull, notExists, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.ts';

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
	salary: string | null;
	postedAt: string | null;
	summary: string | null;
	matchScore: number | null;
	matchReasons: string[];
}

export function applyVia(row: { source: 'linkedin' | 'glassdoor'; applyUrl: string | null }) {
	return row.applyUrl ? 'company' : row.source;
}

export function jobDto(row: typeof schema.job.$inferSelect): JobDto {
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
export function feed(userId: string, limit = 200): JobDto[] {
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
	return rows.map(jobDto);
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
