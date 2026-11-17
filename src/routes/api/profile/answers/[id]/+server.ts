import { json } from '@sveltejs/kit';
import { ApiError, api, requireUser } from '#lib/server/http.ts';
import { deleteAnswer, listAnswers } from '#lib/server/profile.ts';

export const DELETE = api(async (event) => {
	const user = requireUser(event);
	if (!deleteAnswer(user.id, event.params.id!)) {
		throw new ApiError(404, 'answer_not_found', 'Resposta não encontrada.');
	}
	return json(listAnswers(user.id));
});
