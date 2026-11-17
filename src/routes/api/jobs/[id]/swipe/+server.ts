import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { enqueue } from '#lib/server/applications/queue.ts';
import { createApplication, getApplicationForJob } from '#lib/server/applications/store.ts';
import { connectedAccounts } from '#lib/server/browser/service.ts';
import { db, schema } from '#lib/server/db/index.ts';
import { ApiError, api, parseBody, requireUser } from '#lib/server/http.ts';
import { blockedBy, getJob, jobDto } from '#lib/server/jobs/feed.ts';

const Body = z.object({ direction: z.enum(['apply', 'skip']) });

// Idempotent: repeating a swipe returns the same result, so an optimistic UI
// can retry safely. Swiping right is the user's authorization to apply.
export const POST = api(async (event) => {
	const user = requireUser(event);
	const { direction } = await parseBody(event, Body);
	const job = getJob(user.id, event.params.id!);
	if (!job) throw new ApiError(404, 'job_not_found', 'Vaga não encontrada.');

	// Accepting a job is only allowed when the account it goes through is connected;
	// nothing is recorded, so the card stays in the feed until the person connects.
	const accounts = await connectedAccounts(user.id);
	if (direction === 'apply') {
		const provider = blockedBy(job, accounts);
		const existing = provider && getApplicationForJob(user.id, job.id);
		if (provider && !existing) {
			const name = provider === 'linkedin' ? 'LinkedIn' : 'Glassdoor';
			throw new ApiError(
				409,
				'account_not_connected',
				`Conecte sua conta do ${name} para se candidatar a esta vaga.`,
				{ provider }
			);
		}
	}

	db()
		.insert(schema.swipe)
		.values({ userId: user.id, jobId: job.id, direction, createdAt: Date.now() })
		.onConflictDoUpdate({
			target: [schema.swipe.userId, schema.swipe.jobId],
			set: { direction }
		})
		.run();

	if (direction === 'skip') {
		return json({ job: jobDto(job, accounts), direction, application: null });
	}

	const { dto, created } = createApplication(user.id, job.id);
	if (created) enqueue(user.id, dto.id);
	return json(
		{ job: jobDto(job, accounts), direction, application: dto },
		{ status: created ? 201 : 200 }
	);
});
