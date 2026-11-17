import fs from 'node:fs/promises';
import { ApiError, api, requireUser } from '#lib/server/http.ts';
import { resumePdfPath } from '#lib/server/resume.ts';

export const GET = api(async (event) => {
	const user = requireUser(event);
	const file = await fs.readFile(resumePdfPath(user.id)).catch(() => null);
	if (!file) throw new ApiError(404, 'pdf_not_found', 'Compile o currículo para gerar o PDF.');
	return new Response(new Uint8Array(file), {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': 'inline; filename="curriculo.pdf"',
			'cache-control': 'private, no-store'
		}
	});
});
