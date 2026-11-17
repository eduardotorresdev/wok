import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { api, parseBody, requireUser } from '#lib/server/http.ts';
import { getResume, saveResume } from '#lib/server/resume.ts';

const Body = z.object({ latex: z.string().max(200_000, 'LaTeX grande demais (máx. 200 kB).') });

export const GET = api(async (event) => json(getResume(requireUser(event).id)));

export const PUT = api(async (event) => {
	const user = requireUser(event);
	const { latex } = await parseBody(event, Body);
	return json(saveResume(user.id, latex));
});
