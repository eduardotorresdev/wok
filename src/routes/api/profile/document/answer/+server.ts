import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { api, parseBody, requireUser } from '#lib/server/http.ts';
import { answerQuestion } from '#lib/server/profile-document.ts';

const Body = z.object({
	questionId: z.string().min(1).max(100),
	answer: z.string().trim().min(1).max(4000)
});

// Writes the answer into the right section of the saved document.
export const POST = api(async (event) => {
	const user = requireUser(event);
	const { questionId, answer } = await parseBody(event, Body);
	return json(await answerQuestion(user.id, questionId, answer));
});
