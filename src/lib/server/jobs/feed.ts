import { and, eq, notExists, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.ts';

export interface JobDto {
	id: string;
	title: string;
	company: string;
	companyLogo: string | null;
	location: string | null;
	source: 'linkedin' | 'glassdoor';
	url: string;
	salary: string | null;
	postedAt: string | null;
	summary: string | null;
	matchScore: number | null;
	matchReasons: string[];
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
		salary: row.salary,
		postedAt: row.postedAt,
		summary: row.summary,
		matchScore: row.matchScore,
		matchReasons: row.matchReasons ?? []
	};
}

/** Jobs not swiped yet, best match first; unscored ones (still being evaluated) go last. */
export function feed(userId: string, limit = 50): JobDto[] {
	const rows = db()
		.select()
		.from(schema.job)
		.where(
			and(
				eq(schema.job.userId, userId),
				notExists(
					db()
						.select({ one: sql`1` })
						.from(schema.swipe)
						.where(and(eq(schema.swipe.userId, userId), eq(schema.swipe.jobId, schema.job.id)))
				)
			)
		)
		.orderBy(
			sql`${schema.job.matchScore} is null`,
			sql`${schema.job.matchScore} desc`,
			sql`${schema.job.createdAt} desc`
		)
		.limit(limit)
		.all();
	return rows.map(jobDto);
}

export function getJob(userId: string, jobId: string) {
	return db()
		.select()
		.from(schema.job)
		.where(and(eq(schema.job.userId, userId), eq(schema.job.id, jobId)))
		.get();
}
