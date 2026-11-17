import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { openForUser, takeControl } from '#lib/server/browser/service.ts';
import { api, parseBody, requireUser } from '#lib/server/http.ts';

const Body = z.object({ url: z.string().trim().max(2000).optional() });

// With a url: opens it and gives the user control ("connect accounts").
// Without one: takes control of whatever page is already open, which is how
// the user acts on the page a paused application left behind.
export const POST = api(async (event) => {
	const user = requireUser(event);
	const { url } = await parseBody(event, Body);
	const applicationId = event.url.searchParams.get('applicationId');
	return json(
		url ? await openForUser(user.id, url, applicationId) : await takeControl(user.id, applicationId)
	);
});
