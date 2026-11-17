import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { api, parseBody, requireUser } from '#lib/server/http.ts';
import { MAX_MARKDOWN, getDocument, saveDocument } from '#lib/server/profile-document.ts';

const Body = z.object({ markdown: z.string().max(MAX_MARKDOWN) });

// The professional profile: free markdown the person writes and confirms.
// Someone without one gets 200 with empty markdown.
export const GET = api(async (event) => json(getDocument(requireUser(event).id)));

export const PUT = api(async (event) => {
	const user = requireUser(event);
	const { markdown } = await parseBody(event, Body);
	return json(saveDocument(user.id, markdown));
});
