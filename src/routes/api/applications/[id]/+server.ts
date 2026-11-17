import { json } from '@sveltejs/kit';
import { getApplication } from '#lib/server/applications/store.ts';
import { ApiError, api, requireUser } from '#lib/server/http.ts';

export const GET = api(async (event) => {
	const application = getApplication(requireUser(event).id, event.params.id!);
	if (!application) throw new ApiError(404, 'application_not_found', 'Inscrição não encontrada.');
	return json(application);
});
