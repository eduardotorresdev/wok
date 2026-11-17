import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { ApiError, api, requireUser } from '#lib/server/http.ts';
import { compileResume, saveResume } from '#lib/server/resume.ts';

const Body = z.object({ latex: z.string().max(200_000).optional() });

// A LaTeX error is a normal outcome of this call, not a transport failure:
// it answers 200 with ok:false, pages:0 and the log so the editor can show it.
export const POST = api(async (event) => {
	const user = requireUser(event);
	const text = await event.request.text();
	if (text.trim()) {
		let raw: unknown;
		try {
			raw = JSON.parse(text);
		} catch {
			throw new ApiError(400, 'invalid_json', 'Corpo da requisição não é JSON válido.');
		}
		const parsed = Body.safeParse(raw);
		if (!parsed.success) throw new ApiError(400, 'invalid_body', 'latex inválido.');
		if (parsed.data.latex !== undefined) saveResume(user.id, parsed.data.latex);
	}
	const result = await compileResume(user.id);
	if (!result)
		throw new ApiError(409, 'resume_empty', 'Envie o currículo em LaTeX antes de compilar.');
	return json(result);
});
