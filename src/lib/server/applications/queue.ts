import { isStopping } from '../lifecycle.ts';
import { getRow, setStatus, unfinished } from './store.ts';

type Runner = (applicationId: string) => Promise<void>;

// One application at a time per user: the applier drives that user's single
// browser profile, and a human pace is part of not getting the account flagged.
const chains = new Map<string, Promise<void>>();
const pending = new Set<string>();
let runner: Runner | undefined;

export function setRunner(fn: Runner) {
	runner = fn;
}

export function enqueue(userId: string, applicationId: string) {
	if (pending.has(applicationId) || !runner) return;
	pending.add(applicationId);
	const previous = chains.get(userId) ?? Promise.resolve();
	const next = previous
		.then(async () => {
			// Left as queued: the next boot picks it up.
			if (isStopping()) return;
			await runner!(applicationId);
		})
		.catch((err) => {
			if (isStopping()) return;
			console.error(`[queue] application ${applicationId} crashed`, err);
			const row = getRow(applicationId);
			if (row && row.status !== 'submitted' && row.status !== 'needs_user') {
				setStatus(
					applicationId,
					'failed',
					`Falha inesperada: ${err instanceof Error ? err.message : String(err)}`
				);
			}
		})
		.finally(() => {
			pending.delete(applicationId);
			if (chains.get(userId) === next) chains.delete(userId);
		});
	chains.set(userId, next);
}

export function isBusy(userId: string) {
	return chains.has(userId);
}

/** After a restart, put back what was queued or interrupted mid-run. */
export function recoverQueue() {
	for (const row of unfinished()) {
		if (row.status !== 'queued') {
			setStatus(row.id, 'queued', 'Servidor reiniciou; inscrição voltou para a fila.');
		}
		enqueue(row.userId, row.id);
	}
}
