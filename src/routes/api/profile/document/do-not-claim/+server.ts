import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { api, parseBody, requireUser } from '#lib/server/http.ts';
import { addDoNotClaim } from '#lib/server/profile-document.ts';

const Body = z.object({ statement: z.string().trim().min(1).max(500) });

// The person refused something that was written about them: from now on it is
// a hard restriction for every résumé and form.
export const POST = api(async (event) => {
	const user = requireUser(event);
	const { statement } = await parseBody(event, Body);
	return json(addDoNotClaim(user.id, statement));
});
