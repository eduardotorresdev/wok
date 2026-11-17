import { json } from '@sveltejs/kit';
import { ApiError, api, requireUser } from '#lib/server/http.ts';
import { latestRun, startSearch } from '#lib/server/jobs/search.ts';
import { getPreferences } from '#lib/server/preferences.ts';

// Collection takes from 20 s to a couple of minutes, so it runs in the
// background: POST answers 202 with the run, GET reports its progress.
export const POST = api(async (event) => {
	const user = requireUser(event);
	const prefs = getPreferences(user.id);
	if (!prefs.terms.length && !prefs.area) {
		throw new ApiError(
			409,
			'preferences_empty',
			'Defina termos de busca ou área antes de buscar vagas.'
		);
	}
	const { run, started } = startSearch(user.id);
	return json({ run }, { status: started ? 202 : 200 });
});

export const GET = api(async (event) => json({ run: latestRun(requireUser(event).id) }));
