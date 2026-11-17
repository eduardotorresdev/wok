import { isStopping } from '../lifecycle.ts';
import { getRow, setStatus, unfinished } from './store.ts';

type Runner = (applicationId: string) => Promise<void>;

// One application at a time per user: the applier drives that user's single
// browser profile, and a human pace is part of not getting the account flagged.
const chains = new Map<string, Promise<void>>();
const pending = new Set<string>();
let runner: Runner | undefined;

/**
 * Thrown by the runner when the run died of a passing failure (network, the
 * model's service down): the application goes back to the queue instead of failing.
 */
export class RetryLater extends Error {}

/**
 * The run died of a passing failure AFTER doing something that may have sent
 * the application. Never repeated automatically: the person checks the page.
 */
export class MaybeSubmitted extends Error {}

export const MAYBE_SUBMITTED_MESSAGE =
	'Posso ter enviado esta candidatura antes de a conexão cair. Confira na página se ela consta como enviada.';

export const REQUEUE_WAITS_MS = [30_000, 120_000];
const requeues = new Map<string, number>();

let onPaused: ((applicationId: string) => unknown) | undefined;

/** `paused` runs after the queue itself pauses an application (it may notify the person). */
export function setRunner(fn: Runner, paused?: (applicationId: string) => unknown) {
	runner = fn;
	onPaused = paused;
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
		.then(() => void requeues.delete(applicationId))
		.catch((err) => {
			if (isStopping()) return;
			const row = getRow(applicationId);
			const settled = !row || row.status === 'submitted' || row.status === 'needs_user';
			if (err instanceof MaybeSubmitted && !settled) {
				requeues.delete(applicationId);
				console.warn(`[queue] application ${applicationId} may have been sent: ${err.message}`);
				setStatus(applicationId, 'needs_user', MAYBE_SUBMITTED_MESSAGE, { needsKind: 'browser' });
				return void onPaused?.(applicationId);
			}
			if (err instanceof RetryLater && !settled) {
				const done = requeues.get(applicationId) ?? 0;
				if (done < REQUEUE_WAITS_MS.length) {
					const wait = REQUEUE_WAITS_MS[done];
					requeues.set(applicationId, done + 1);
					console.warn(`[queue] application ${applicationId} back to the queue: ${err.message}`);
					setStatus(
						applicationId,
						'queued',
						`Falha de conexão no meio da inscrição. Vou tentar de novo em ${wait >= 60_000 ? `${wait / 60_000} min` : `${wait / 1000} s`} (tentativa ${done + 2} de ${REQUEUE_WAITS_MS.length + 1}).`
					);
					// A restart in the meantime picks it up anyway: it is queued in the database.
					setTimeout(() => enqueue(userId, applicationId), wait).unref();
					return;
				}
				requeues.delete(applicationId);
				return void setStatus(
					applicationId,
					'failed',
					`Tentei ${REQUEUE_WAITS_MS.length + 1} vezes e a conexão falhou em todas: ${err.message} Toque em tentar de novo quando quiser.`
				);
			}
			requeues.delete(applicationId);
			console.error(`[queue] application ${applicationId} crashed`, err);
			if (!settled) {
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
