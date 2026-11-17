import fs from 'node:fs/promises';
import { getRow } from '#lib/server/applications/store.ts';
import { ApiError, api, requireUser } from '#lib/server/http.ts';

export const GET = api(async (event) => {
	const user = requireUser(event);
	const row = getRow(event.params.id!);
	if (!row || row.userId !== user.id) {
		throw new ApiError(404, 'application_not_found', 'Inscrição não encontrada.');
	}
	const file = row.tailoredPdfPath
		? await fs.readFile(row.tailoredPdfPath).catch(() => null)
		: null;
	if (!file) throw new ApiError(404, 'pdf_not_found', 'O currículo adaptado ainda não foi gerado.');
	return new Response(new Uint8Array(file), {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': 'inline; filename="curriculo-adaptado.pdf"',
			'cache-control': 'private, no-store'
		}
	});
});
