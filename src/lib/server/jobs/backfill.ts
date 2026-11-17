import fs from 'node:fs';
import path from 'node:path';
import { ApifyClient } from 'apify-client';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '../db/index.ts';
import { config } from '../env.ts';

// Postings stored before applyType existed have it empty. Our database never
// kept the raw items, but Apify keeps each run's dataset for some days, so the
// field is read back from the recent runs of both actors. Runs once: what is
// still empty afterwards is filled when a later search finds the posting again.

const ACTORS = [
	{
		id: 'valig/linkedin-jobs-scraper',
		source: 'linkedin' as const,
		type: (it: Record<string, unknown>) =>
			it.applyType === 'EASY_APPLY' ? 'easy' : it.applyType === 'EXTERNAL' ? 'external' : null
	},
	{
		id: 'valig/glassdoor-jobs-scraper',
		source: 'glassdoor' as const,
		type: (it: Record<string, unknown>) =>
			it.easyApply === true ? 'easy' : it.easyApply === false ? 'external' : null
	}
];
const RUNS_PER_ACTOR = 60;

const marker = () => path.join(config.dataDir, 'apply-type-backfill.done');

export async function backfillApplyTypes() {
	if (!config.apifyToken || fs.existsSync(marker())) return;
	const missing = db()
		.select({ id: schema.job.id })
		.from(schema.job)
		.where(isNull(schema.job.applyType))
		.limit(1)
		.get();
	if (missing) {
		const client = new ApifyClient({ token: config.apifyToken });
		let filled = 0;
		for (const actor of ACTORS) {
			const runs = await client.actor(actor.id).runs().list({ desc: true, limit: RUNS_PER_ACTOR });
			for (const run of runs.items) {
				if (run.status !== 'SUCCEEDED' || !run.defaultDatasetId) continue;
				const { items } = await client
					.dataset(run.defaultDatasetId)
					.listItems({ limit: 1000, fields: ['id', 'applyType', 'easyApply'] })
					.catch(() => ({ items: [] as Record<string, unknown>[] }));
				for (const it of items as Record<string, unknown>[]) {
					const applyType = actor.type(it);
					if (!applyType || (typeof it.id !== 'string' && typeof it.id !== 'number')) continue;
					filled += db()
						.update(schema.job)
						.set({ applyType })
						.where(
							and(
								eq(schema.job.source, actor.source),
								eq(schema.job.externalId, String(it.id)),
								isNull(schema.job.applyType)
							)
						)
						.run().changes;
				}
			}
		}
		console.log(`[backfill] applyType filled on ${filled} stored postings`);
	}
	fs.mkdirSync(config.dataDir, { recursive: true });
	fs.writeFileSync(marker(), new Date().toISOString());
}
