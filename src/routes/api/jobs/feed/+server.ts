import { json } from '@sveltejs/kit';
import { api, requireUser } from '#lib/server/http.ts';
import { feed } from '#lib/server/jobs/feed.ts';

export const GET = api(async (event) => json(feed(requireUser(event).id)));
