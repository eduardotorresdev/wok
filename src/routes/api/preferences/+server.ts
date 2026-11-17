import { json } from '@sveltejs/kit';
import { api, parseBody, requireUser } from '#lib/server/http.ts';
import { PreferencesInput, getPreferences, savePreferences } from '#lib/server/preferences.ts';

export const GET = api(async (event) => json(getPreferences(requireUser(event).id)));

export const PUT = api(async (event) => {
	const user = requireUser(event);
	const input = await parseBody(event, PreferencesInput);
	const { preferences } = savePreferences(user.id, input);
	return json(preferences);
});
