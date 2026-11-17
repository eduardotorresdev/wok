import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { enqueue } from '#lib/server/applications/queue.ts';
import { getApplication, getRow, logStep, setStatus } from '#lib/server/applications/store.ts';
import { ApiError, api, parseBody, requireUser } from '#lib/server/http.ts';
import { applyProfileAnswer, saveAnswer } from '#lib/server/profile.ts';
import { rememberAnswer } from '#lib/server/profile-document.ts';

const Body = z.object({ answer: z.string().trim().min(1).max(2000) });

// Answers the question that paused the application. The answer is stored as a
// confirmed answer (reused on later forms) and the application goes back to the queue.
export const POST = api(async (event) => {
	const user = requireUser(event);
	const id = event.params.id!;
	const { answer } = await parseBody(event, Body);
	const row = getRow(id);
	if (!row || row.userId !== user.id) {
		throw new ApiError(404, 'application_not_found', 'Inscrição não encontrada.');
	}
	if (row.status !== 'needs_user' || !row.pendingQuestion) {
		throw new ApiError(
			409,
			'no_pending_question',
			'Esta inscrição não está esperando uma resposta.'
		);
	}
	// Name and phone belong in the profile; everything else becomes a reusable answer.
	if (!applyProfileAnswer(user.id, row.pendingQuestion, answer)) {
		saveAnswer(user.id, row.pendingQuestion, answer);
		// What the person tells us once goes into their profile, for every later résumé and form.
		rememberAnswer(user.id, row.pendingQuestion, answer);
	}
	logStep(id, 'user_answer', `Você respondeu: ${answer}`, {
		question: row.pendingQuestion,
		answer
	});
	setStatus(id, 'queued', 'Resposta recebida; retomando a inscrição.');
	enqueue(user.id, id);
	return json(getApplication(user.id, id));
});
