import { json } from '@sveltejs/kit';
import { api, parseBody, requireUser } from '#lib/server/http.ts';
import { ProfileInput, getProfile, saveProfile } from '#lib/server/profile.ts';

export const GET = api(async (event) => json(getProfile(requireUser(event).id)));

// Full replace: send the whole profile. Omitted fields fall back to empty defaults.
export const PUT = api(async (event) => {
	const user = requireUser(event);
	return json(saveProfile(user.id, await parseBody(event, ProfileInput)));
});
