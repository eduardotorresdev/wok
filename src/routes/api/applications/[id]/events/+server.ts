import { getApplication, listSteps, subscribe } from '#lib/server/applications/store.ts';
import { ApiError, api, requireUser } from '#lib/server/http.ts';
import { sse } from '#lib/server/sse.ts';

// SSE: "application" carries the full resource on every status change and
// "step" each new log line. ?after=<stepId> (or Last-Event-ID is not used)
// replays only the steps the client has not seen.
export const GET = api(async (event) => {
	const user = requireUser(event);
	const id = event.params.id!;
	const application = getApplication(user.id, id);
	if (!application) throw new ApiError(404, 'application_not_found', 'Inscrição não encontrada.');
	const after = Number(event.url.searchParams.get('after') ?? 0) || 0;

	return sse(event.request, (channel) => {
		// Subscribe before replaying so nothing emitted in between is lost;
		// step ids make the overlap easy to drop.
		let lastStep = after;
		const queued: Parameters<Parameters<typeof subscribe>[1]>[0][] = [];
		let replaying = true;
		const forward = (e: (typeof queued)[number]) => {
			if (e.type === 'step') {
				if (e.step.id <= lastStep) return;
				lastStep = e.step.id;
				channel.send('step', e.step);
			} else channel.send('application', e.application);
		};
		const unsubscribe = subscribe(id, (e) => (replaying ? queued.push(e) : forward(e)));
		const current: Partial<typeof application> = { ...getApplication(user.id, id)! };
		delete current.steps;
		channel.send('application', current);
		for (const step of listSteps(id, after)) forward({ type: 'step', step });
		replaying = false;
		for (const e of queued) forward(e);
		return unsubscribe;
	});
});
