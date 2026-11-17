import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { api, parseBody, requireUser } from '#lib/server/http.ts';
import { listAnswers, saveAnswer } from '#lib/server/profile.ts';

const Body = z.object({
	question: z.string().trim().min(1).max(500),
	answer: z.string().trim().min(1).max(2000)
});

export const GET = api(async (event) => json(listAnswers(requireUser(event).id)));

/** Adds or replaces the answer for a question; returns the full list. */
export const POST = api(async (event) => {
	const user = requireUser(event);
	const { question, answer } = await parseBody(event, Body);
	saveAnswer(user.id, question, answer);
	return json(listAnswers(user.id));
});
