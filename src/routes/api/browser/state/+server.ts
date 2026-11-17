import { json } from '@sveltejs/kit';
import { getState } from '#lib/server/browser/service.ts';
import { api, requireUser } from '#lib/server/http.ts';

export const GET = api(async (event) => json(await getState(requireUser(event).id)));
