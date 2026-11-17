import { integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Auth tables (user, session, account, verification) belong to Better Auth and
// are migrated by it at startup; user ids are referenced here as plain text.

export const resume = sqliteTable('resume', {
	userId: text('user_id').primaryKey(),
	latex: text('latex').notNull(),
	pages: integer('pages'),
	/** sha256 of the latex that produced the PDF currently on disk. */
	compiledHash: text('compiled_hash'),
	updatedAt: integer('updated_at').notNull()
});

export const preferences = sqliteTable('preferences', {
	userId: text('user_id').primaryKey(),
	terms: text('terms', { mode: 'json' }).$type<string[]>().notNull(),
	locations: text('locations', { mode: 'json' }).$type<string[]>().notNull(),
	remote: integer('remote', { mode: 'boolean' }).notNull(),
	area: text('area').notNull(),
	seniority: text('seniority').notNull(),
	updatedAt: integer('updated_at').notNull()
});

export const areaStrategy = sqliteTable('area_strategy', {
	area: text('area').primaryKey(),
	content: text('content').notNull(),
	sources: text('sources', { mode: 'json' }).$type<string[]>().notNull(),
	updatedAt: integer('updated_at').notNull()
});

export type JobSource = 'linkedin' | 'glassdoor';

export const job = sqliteTable(
	'job',
	{
		id: text('id').primaryKey(),
		userId: text('user_id').notNull(),
		source: text('source').$type<JobSource>().notNull(),
		externalId: text('external_id').notNull(),
		title: text('title').notNull(),
		company: text('company').notNull(),
		location: text('location'),
		url: text('url').notNull(),
		applyUrl: text('apply_url'),
		salary: text('salary'),
		postedAt: text('posted_at'),
		summary: text('summary'),
		description: text('description'),
		matchScore: integer('match_score'),
		matchReasons: text('match_reasons', { mode: 'json' }).$type<string[]>(),
		createdAt: integer('created_at').notNull()
	},
	(t) => [uniqueIndex('job_user_source_ext').on(t.userId, t.source, t.externalId)]
);

export const swipe = sqliteTable(
	'swipe',
	{
		userId: text('user_id').notNull(),
		jobId: text('job_id').notNull(),
		direction: text('direction').$type<'apply' | 'skip'>().notNull(),
		createdAt: integer('created_at').notNull()
	},
	(t) => [primaryKey({ columns: [t.userId, t.jobId] })]
);

export type ApplicationStatus =
	'queued' | 'tailoring' | 'applying' | 'needs_user' | 'submitted' | 'failed';

export const application = sqliteTable(
	'application',
	{
		id: text('id').primaryKey(),
		userId: text('user_id').notNull(),
		jobId: text('job_id').notNull(),
		status: text('status').$type<ApplicationStatus>().notNull(),
		tailoredLatex: text('tailored_latex'),
		tailoredPdfPath: text('tailored_pdf_path'),
		lastMessage: text('last_message'),
		createdAt: integer('created_at').notNull(),
		updatedAt: integer('updated_at').notNull()
	},
	(t) => [uniqueIndex('application_user_job').on(t.userId, t.jobId)]
);

export const applicationStep = sqliteTable('application_step', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	applicationId: text('application_id').notNull(),
	kind: text('kind').notNull(),
	message: text('message').notNull(),
	data: text('data', { mode: 'json' }).$type<Record<string, unknown>>(),
	createdAt: integer('created_at').notNull()
});

export const searchRun = sqliteTable('search_run', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull(),
	status: text('status').$type<'running' | 'done' | 'failed'>().notNull(),
	message: text('message'),
	found: integer('found').notNull().default(0),
	startedAt: integer('started_at').notNull(),
	finishedAt: integer('finished_at')
});
