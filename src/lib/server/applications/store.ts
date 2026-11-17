import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { and, asc, desc, eq, gt, inArray } from 'drizzle-orm';
import { db, schema } from '../db/index.ts';
import type { ApplicationStatus } from '../db/schema.ts';
import { jobDto, type JobDto } from '../jobs/feed.ts';

export interface StepDto {
	id: number;
	kind: string;
	message: string;
	data: Record<string, unknown> | null;
	createdAt: string;
}

export interface ApplicationDto {
	id: string;
	job: JobDto;
	status: ApplicationStatus;
	tailoredPdfUrl: string | null;
	lastMessage: string | null;
	/**
	 * While needs_user: 'question' (answer pendingQuestion), 'browser' (act in the
	 * browser, then resume) or 'resume' (fix the résumé at /curriculo, then resume).
	 */
	needsKind: 'question' | 'browser' | 'resume' | null;
	pendingQuestion: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface ApplicationDetailDto extends ApplicationDto {
	steps: StepDto[];
}

type Row = typeof schema.application.$inferSelect;

const bus = new EventEmitter();
bus.setMaxListeners(0);

export type ApplicationEvent =
	{ type: 'application'; application: ApplicationDto } | { type: 'step'; step: StepDto };

export function subscribe(applicationId: string, listener: (e: ApplicationEvent) => void) {
	bus.on(applicationId, listener);
	return () => bus.off(applicationId, listener);
}

function stepDto(row: typeof schema.applicationStep.$inferSelect): StepDto {
	return {
		id: row.id,
		kind: row.kind,
		message: row.message,
		data: row.data ?? null,
		createdAt: new Date(row.createdAt).toISOString()
	};
}

function toDto(row: Row, job: typeof schema.job.$inferSelect): ApplicationDto {
	return {
		id: row.id,
		job: jobDto(job),
		status: row.status,
		tailoredPdfUrl: row.tailoredPdfPath
			? `/api/applications/${row.id}/pdf?v=${row.updatedAt}`
			: null,
		lastMessage: row.lastMessage,
		needsKind: row.status === 'needs_user' ? row.needsKind : null,
		pendingQuestion: row.status === 'needs_user' ? row.pendingQuestion : null,
		createdAt: new Date(row.createdAt).toISOString(),
		updatedAt: new Date(row.updatedAt).toISOString()
	};
}

export function getRow(applicationId: string) {
	return db()
		.select()
		.from(schema.application)
		.where(eq(schema.application.id, applicationId))
		.get();
}

function dtoFor(row: Row): ApplicationDto {
	const job = db().select().from(schema.job).where(eq(schema.job.id, row.jobId)).get();
	return toDto(row, job!);
}

export function listApplications(userId: string): ApplicationDto[] {
	return db()
		.select()
		.from(schema.application)
		.innerJoin(schema.job, eq(schema.job.id, schema.application.jobId))
		.where(eq(schema.application.userId, userId))
		.orderBy(desc(schema.application.updatedAt))
		.all()
		.map((r) => toDto(r.application, r.job));
}

export function listSteps(applicationId: string, afterId = 0): StepDto[] {
	return db()
		.select()
		.from(schema.applicationStep)
		.where(
			and(
				eq(schema.applicationStep.applicationId, applicationId),
				gt(schema.applicationStep.id, afterId)
			)
		)
		.orderBy(asc(schema.applicationStep.id))
		.all()
		.map(stepDto);
}

export function getApplication(userId: string, applicationId: string): ApplicationDetailDto | null {
	const row = getRow(applicationId);
	if (!row || row.userId !== userId) return null;
	return { ...dtoFor(row), steps: listSteps(applicationId) };
}

/** Appends to the application's log, mirrors it into lastMessage and notifies listeners. */
export function logStep(
	applicationId: string,
	kind: string,
	message: string,
	data?: Record<string, unknown>
) {
	const now = Date.now();
	const res = db()
		.insert(schema.applicationStep)
		.values({ applicationId, kind, message, data: data ?? null, createdAt: now })
		.run();
	bus.emit(applicationId, {
		type: 'step',
		step: {
			id: Number(res.lastInsertRowid),
			kind,
			message,
			data: data ?? null,
			createdAt: new Date(now).toISOString()
		}
	} satisfies ApplicationEvent);
}

export function update(
	applicationId: string,
	patch: Partial<
		Pick<
			Row,
			| 'status'
			| 'lastMessage'
			| 'tailoredLatex'
			| 'tailoredPdfPath'
			| 'needsKind'
			| 'pendingQuestion'
		>
	>
) {
	db()
		.update(schema.application)
		.set({ ...patch, updatedAt: Date.now() })
		.where(eq(schema.application.id, applicationId))
		.run();
	const row = getRow(applicationId);
	if (row)
		bus.emit(applicationId, {
			type: 'application',
			application: dtoFor(row)
		} satisfies ApplicationEvent);
	return row;
}

/** Remembers where the applier is, without notifying anyone: it changes on every navigation. */
export function setLastUrl(applicationId: string, url: string) {
	if (!/^https?:/i.test(url)) return;
	db()
		.update(schema.application)
		.set({ lastUrl: url })
		.where(eq(schema.application.id, applicationId))
		.run();
}

/** Status change with a log line; the usual way the pipeline reports progress. */
export function setStatus(
	applicationId: string,
	status: ApplicationStatus,
	message: string,
	extra: Partial<Pick<Row, 'needsKind' | 'pendingQuestion'>> = {}
) {
	logStep(applicationId, 'status', message, { status });
	return update(applicationId, {
		status,
		lastMessage: message,
		needsKind: status === 'needs_user' ? (extra.needsKind ?? 'browser') : null,
		pendingQuestion: status === 'needs_user' ? (extra.pendingQuestion ?? null) : null
	});
}

/** Returns the application for this job, creating it (queued) on the first apply swipe. */
export function createApplication(
	userId: string,
	jobId: string
): { dto: ApplicationDto; created: boolean } {
	const existing = db()
		.select()
		.from(schema.application)
		.where(and(eq(schema.application.userId, userId), eq(schema.application.jobId, jobId)))
		.get();
	if (existing) return { dto: dtoFor(existing), created: false };
	const now = Date.now();
	const id = randomUUID();
	db()
		.insert(schema.application)
		.values({
			id,
			userId,
			jobId,
			status: 'queued',
			lastMessage: 'Na fila para adaptar o currículo.',
			createdAt: now,
			updatedAt: now
		})
		.run();
	logStep(id, 'status', 'Inscrição criada e colocada na fila.', { status: 'queued' });
	return { dto: dtoFor(getRow(id)!), created: true };
}

/** Applications a previous process left mid-flight, oldest first. */
export function unfinished() {
	return db()
		.select()
		.from(schema.application)
		.where(inArray(schema.application.status, ['queued', 'tailoring', 'applying']))
		.orderBy(asc(schema.application.createdAt))
		.all();
}
