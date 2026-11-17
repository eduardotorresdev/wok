import { json } from '@sveltejs/kit';
import { getApplication, getRow, logStep, setStatus } from '#lib/server/applications/store.ts';
import { closeForUser } from '#lib/server/browser/service.ts';
import { ApiError, api, requireUser } from '#lib/server/http.ts';

// The person applied by themselves on the site (for instance when the job board
// demands a human check) and records it here. The tailored résumé stays available.
export const POST = api(async (event) => {
	const user = requireUser(event);
	const id = event.params.id!;
	const row = getRow(id);
	if (!row || row.userId !== user.id) {
		throw new ApiError(404, 'application_not_found', 'Inscrição não encontrada.');
	}
	if (row.status !== 'needs_user' && row.status !== 'failed') {
		throw new ApiError(
			409,
			'not_markable',
			'Só dá para marcar como enviada uma inscrição pausada ou que falhou.'
		);
	}
	await closeForUser(user.id, id).catch(() => {});
	logStep(id, 'user_submitted', 'Você enviou esta candidatura por conta própria.');
	setStatus(id, 'submitted', 'Enviada por você, fora do WOK.');
	return json(getApplication(user.id, id));
});
