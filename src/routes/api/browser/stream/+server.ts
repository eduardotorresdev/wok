import { watch } from '#lib/server/browser/service.ts';
import { api, requireUser } from '#lib/server/http.ts';
import { sse } from '#lib/server/sse.ts';

// Read-only live view, also while the agent drives. Events: "frame"
// {jpeg (base64), width, height} and "state" (same shape as /api/browser/state).
// The last frame is sent on connect; frames only arrive when the page changes.
// ?applicationId= follows that application's tab; without it, the default tab.
export const GET = api(async (event) => {
	const user = requireUser(event);
	return sse(event.request, (channel) =>
		watch(user.id, event.url.searchParams.get('applicationId'), (e) =>
			e.type === 'frame' ? channel.send('frame', e.frame) : channel.send('state', e.state)
		)
	);
});
