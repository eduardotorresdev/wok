import { eq } from 'drizzle-orm';
import { db, schema } from './db';
import { compileLatex, hashLatex, userDir, withLock } from './latex';

export interface ResumeDto {
	latex: string;
	/** Page count of the last successful compile of this exact source, else null. */
	pages: number | null;
	pdfUrl: string | null;
	updatedAt: string | null;
}

function toDto(row: typeof schema.resume.$inferSelect | undefined): ResumeDto {
	if (!row) return { latex: '', pages: null, pdfUrl: null, updatedAt: null };
	const compiled = row.compiledHash === hashLatex(row.latex);
	return {
		latex: row.latex,
		pages: compiled ? row.pages : null,
		pdfUrl: compiled ? `/api/resume/pdf?v=${row.compiledHash!.slice(0, 12)}` : null,
		updatedAt: new Date(row.updatedAt).toISOString()
	};
}

export function getResumeRow(userId: string) {
	return db().select().from(schema.resume).where(eq(schema.resume.userId, userId)).get();
}

export function getResume(userId: string): ResumeDto {
	return toDto(getResumeRow(userId));
}

export function saveResume(userId: string, latex: string): ResumeDto {
	const now = Date.now();
	db()
		.insert(schema.resume)
		.values({ userId, latex, updatedAt: now })
		.onConflictDoUpdate({ target: schema.resume.userId, set: { latex, updatedAt: now } })
		.run();
	return getResume(userId);
}

export function resumePdfPath(userId: string) {
	return userDir(userId, 'resume', 'main.pdf');
}

export async function compileResume(userId: string) {
	return withLock(`compile:${userId}`, async () => {
		const row = getResumeRow(userId);
		if (!row || !row.latex.trim()) return null;
		const result = await compileLatex(row.latex, userDir(userId, 'resume'));
		const hash = hashLatex(row.latex);
		db()
			.update(schema.resume)
			.set({ pages: result.ok ? result.pages : null, compiledHash: result.ok ? hash : null })
			.where(eq(schema.resume.userId, userId))
			.run();
		return {
			ok: result.ok,
			pages: result.pages,
			pdfUrl: result.ok ? `/api/resume/pdf?v=${hash.slice(0, 12)}` : null,
			log: result.log,
			explanation: result.explanation,
			errors: result.errors
		};
	});
}
