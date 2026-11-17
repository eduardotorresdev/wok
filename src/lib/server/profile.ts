import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from './db/index.ts';
import type { ProfileData } from './db/schema.ts';

const short = z.string().trim().max(200);

const range = z
	.object({
		min: z.number().nonnegative().nullable().default(null),
		max: z.number().nonnegative().nullable().default(null)
	})
	.default({ min: null, max: null });

// Every field is optional on input; what is omitted is stored as its empty default.
export const ProfileInput = z.object({
	fullName: short.default(''),
	phone: short.default(''),
	city: short.default(''),
	country: short.default(''),
	linkedinUrl: short.default(''),
	portfolioLinks: z.array(short.min(1)).max(10).default([]),
	salary: z
		.object({
			currency: z.string().trim().max(8).default('BRL'),
			preferredRegime: z.enum(['clt', 'pj', 'outro', '']).default(''),
			clt: range,
			pj: range
		})
		.default({
			currency: 'BRL',
			preferredRegime: '',
			clt: { min: null, max: null },
			pj: { min: null, max: null }
		}),
	availability: short.default(''),
	workAuthorization: z
		.array(
			z.object({
				country: short.min(1),
				authorized: z.boolean(),
				note: short.default('')
			})
		)
		.max(20)
		.default([]),
	workModel: z.enum(['remote', 'hybrid', 'onsite', 'any']).default('any'),
	willingToRelocate: z.boolean().default(false),
	languages: z
		.array(z.object({ language: short.min(1), level: short.default('') }))
		.max(20)
		.default([]),
	professionalRegistration: z
		.object({ number: short.default(''), state: short.default(''), status: short.default('') })
		.default({ number: '', state: '', status: '' }),
	certifications: z
		.array(z.object({ name: short.min(1), validUntil: short.default('') }))
		.max(30)
		.default([]),
	shifts: z.array(short.min(1)).max(10).default([]),
	confidential: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
	notifyEmail: z.boolean().default(true)
});

export interface ProfileDto extends ProfileData {
	updatedAt: string | null;
}

const EMPTY: ProfileData = ProfileInput.parse({});

export function getProfile(userId: string): ProfileDto {
	const row = db().select().from(schema.profile).where(eq(schema.profile.userId, userId)).get();
	if (!row) return { ...EMPTY, updatedAt: null };
	return { ...EMPTY, ...row.data, updatedAt: new Date(row.updatedAt).toISOString() };
}

export function saveProfile(userId: string, data: ProfileData): ProfileDto {
	const updatedAt = Date.now();
	db()
		.insert(schema.profile)
		.values({ userId, data, updatedAt })
		.onConflictDoUpdate({ target: schema.profile.userId, set: { data, updatedAt } })
		.run();
	return getProfile(userId);
}

/**
 * What every application form asks for. When one is missing the application
 * pauses with the matching question before any form is opened, and the answer
 * goes into the profile itself.
 */
const REQUIRED: { field: 'fullName' | 'phone'; question: string }[] = [
	{
		field: 'fullName',
		question: 'Qual é o seu nome completo, como deve aparecer nas candidaturas?'
	},
	{
		field: 'phone',
		question: 'Qual é o seu telefone com DDD, para os recrutadores entrarem em contato?'
	}
];

export function missingProfileQuestion(profile: ProfileData): string | null {
	return REQUIRED.find((r) => !profile[r.field].trim())?.question ?? null;
}

/** Stores the answer in the profile when the question was about a profile field. */
export function applyProfileAnswer(userId: string, question: string, answer: string): boolean {
	const match = REQUIRED.find((r) => r.question === question);
	if (!match) return false;
	const current: Partial<ProfileDto> = getProfile(userId);
	delete current.updatedAt;
	saveProfile(userId, {
		...(current as ProfileData),
		[match.field]: answer.trim().slice(0, 200)
	});
	return true;
}

export function normalizeQuestion(question: string) {
	return question
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

export interface ConfirmedAnswerDto {
	id: string;
	question: string;
	answer: string;
	updatedAt: string;
}

export function listAnswers(userId: string): ConfirmedAnswerDto[] {
	return db()
		.select()
		.from(schema.confirmedAnswer)
		.where(eq(schema.confirmedAnswer.userId, userId))
		.orderBy(desc(schema.confirmedAnswer.updatedAt))
		.all()
		.map((r) => ({
			id: r.id,
			question: r.question,
			answer: r.answer,
			updatedAt: new Date(r.updatedAt).toISOString()
		}));
}

export function saveAnswer(userId: string, question: string, answer: string) {
	const questionKey = normalizeQuestion(question);
	if (!questionKey) return;
	const updatedAt = Date.now();
	db()
		.insert(schema.confirmedAnswer)
		.values({ id: randomUUID(), userId, questionKey, question, answer, updatedAt })
		.onConflictDoUpdate({
			target: [schema.confirmedAnswer.userId, schema.confirmedAnswer.questionKey],
			set: { question, answer, updatedAt }
		})
		.run();
}

export function deleteAnswer(userId: string, id: string) {
	return (
		db()
			.delete(schema.confirmedAnswer)
			.where(and(eq(schema.confirmedAnswer.userId, userId), eq(schema.confirmedAnswer.id, id)))
			.run().changes > 0
	);
}
