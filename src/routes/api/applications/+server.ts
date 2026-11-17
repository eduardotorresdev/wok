import { json } from '@sveltejs/kit';
import { listApplications } from '#lib/server/applications/store.ts';
import { api, requireUser } from '#lib/server/http.ts';

export const GET = api(async (event) => json(listApplications(requireUser(event).id)));
