import { json } from '@sveltejs/kit';
import { researchArea } from '#lib/server/agent/researcher.ts';
import { api, parseBody, requireUser } from '#lib/server/http.ts';
import { PreferencesInput, getPreferences, savePreferences } from '#lib/server/preferences.ts';
import { getProfile } from '#lib/server/profile.ts';

export const GET = api(async (event) => json(getPreferences(requireUser(event).id)));

export const PUT = api(async (event) => {
	const user = requireUser(event);
	const input = await parseBody(event, PreferencesInput);
	const { preferences, areaChanged } = savePreferences(user.id, input);
	if (areaChanged) {
		// Research for the new area runs in the background; nothing waits for it here.
		void researchArea({
			area: preferences.area,
			seniority: preferences.seniority,
			country: getProfile(user.id).country
		});
	}
	return json(preferences);
});
