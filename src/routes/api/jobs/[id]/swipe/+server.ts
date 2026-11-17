import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { enqueue } from '#lib/server/applications/queue.ts';
import { createApplication } from '#lib/server/applications/store.ts';
import { db, schema } from '#lib/server/db/index.ts';
import { ApiError, api, parseBody, requireUser } from '#lib/server/http.ts';
import { getJob, jobDto } from '#lib/server/jobs/feed.ts';

const Body = z.object({ direction: z.enum(['apply', 'skip']) });

// Idempotent: repeating a swipe returns the same result, so an optimistic UI
// can retry safely. Swiping right is the user's authorization to apply.
export const POST = api(async (event) => {
	const user = requireUser(event);
	const { direction } = await parseBody(event, Body);
	const job = getJob(user.id, event.params.id!);
	if (!job) throw new ApiError(404, 'job_not_found', 'Vaga não encontrada.');

	db()
		.insert(schema.swipe)
		.values({ userId: user.id, jobId: job.id, direction, createdAt: Date.now() })
		.onConflictDoUpdate({
			target: [schema.swipe.userId, schema.swipe.jobId],
			set: { direction }
		})
		.run();

	if (direction === 'skip') return json({ job: jobDto(job), direction, application: null });

	const { dto, created } = createApplication(user.id, job.id);
	if (created) enqueue(user.id, dto.id);
	return json({ job: jobDto(job), direction, application: dto }, { status: created ? 201 : 200 });
});
