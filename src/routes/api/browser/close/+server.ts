import { json } from '@sveltejs/kit';
import { closeForUser } from '#lib/server/browser/service.ts';
import { api, requireUser } from '#lib/server/http.ts';

export const POST = api(async (event) =>
	json(await closeForUser(requireUser(event).id, event.url.searchParams.get('applicationId')))
);
