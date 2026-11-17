import { json } from '@sveltejs/kit';
import { sqlite } from '#lib/server/db/index.ts';

export const GET = () => {
	sqlite().prepare('select 1').get();
	return json({ ok: true });
};
