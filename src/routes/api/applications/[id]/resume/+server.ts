import { json } from '@sveltejs/kit';
import { enqueue } from '#lib/server/applications/queue.ts';
import { getApplication, getRow, setStatus } from '#lib/server/applications/store.ts';
import { ApiError, api, requireUser } from '#lib/server/http.ts';

// Puts a paused (needs_user) or failed application back in the queue, after
// the user logged in / solved a verification in the browser, or to retry.
export const POST = api(async (event) => {
	const user = requireUser(event);
	const id = event.params.id!;
	const row = getRow(id);
	if (!row || row.userId !== user.id) {
		throw new ApiError(404, 'application_not_found', 'Inscrição não encontrada.');
	}
	if (row.status !== 'needs_user' && row.status !== 'failed') {
		throw new ApiError(409, 'not_resumable', 'Esta inscrição não está pausada.');
	}
	setStatus(id, 'queued', 'Retomando a inscrição.');
	enqueue(user.id, id);
	return json(getApplication(user.id, id));
});
