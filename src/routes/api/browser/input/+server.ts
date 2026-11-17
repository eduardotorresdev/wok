import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { userInput } from '#lib/server/browser/service.ts';
import { api, parseBody, requireUser } from '#lib/server/http.ts';

// Coordinates are CSS pixels of the browser viewport (see state.viewport),
// not of the element showing the stream: scale before sending.
const Body = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('tap'),
		x: z.number().min(0).max(4000),
		y: z.number().min(0).max(8000)
	}),
	z.object({ type: z.literal('type'), text: z.string().min(1).max(2000) }),
	z.object({ type: z.literal('key'), key: z.string().min(1).max(40) }),
	z.object({
		type: z.literal('scroll'),
		deltaY: z.number().min(-5000).max(5000),
		x: z.number().optional(),
		y: z.number().optional()
	}),
	z.object({ type: z.literal('back') }),
	z.object({ type: z.literal('reload') })
]);

export const POST = api(async (event) => {
	const user = requireUser(event);
	return json(await userInput(user.id, await parseBody(event, Body)));
});
