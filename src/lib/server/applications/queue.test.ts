import { afterEach, describe, expect, it, vi } from 'vitest';

const rows = new Map<string, { status: string; message: string; needsKind?: string }>();

vi.mock('../lifecycle.ts', () => ({ isStopping: () => false }));
vi.mock('./store.ts', () => ({
	getRow: (id: string) => rows.get(id),
	setStatus: (id: string, status: string, message: string) =>
		void rows.set(id, { status, message }),
	unfinished: () => []
}));

const {
	enqueue,
	setRunner,
	RetryLater,
	MaybeSubmitted,
	MAYBE_SUBMITTED_MESSAGE,
	REQUEUE_WAITS_MS
} = await import('./queue.ts');

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	rows.clear();
});

describe('queue', () => {
	it('puts an application back after a network failure and finishes it later', async () => {
		vi.useFakeTimers();
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		rows.set('a1', { status: 'queued', message: '' });
		let runs = 0;
		setRunner(async (id) => {
			if (++runs === 1) throw new RetryLater('Connection error.');
			rows.set(id, { status: 'submitted', message: 'ok' });
		});
		enqueue('u1', 'a1');
		await vi.advanceTimersByTimeAsync(10);
		expect(rows.get('a1')?.status).toBe('queued');
		expect(rows.get('a1')?.message).toMatch(/tentar de novo em 30 s/);
		await vi.advanceTimersByTimeAsync(REQUEUE_WAITS_MS[0]);
		expect(runs).toBe(2);
		expect(rows.get('a1')?.status).toBe('submitted');
	});

	it('fails only after the first run and two more', async () => {
		vi.useFakeTimers();
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		rows.set('a2', { status: 'queued', message: '' });
		let runs = 0;
		setRunner(async () => {
			runs++;
			throw new RetryLater('Connection error.');
		});
		enqueue('u1', 'a2');
		await vi.advanceTimersByTimeAsync(10);
		await vi.advanceTimersByTimeAsync(REQUEUE_WAITS_MS[0]);
		expect(rows.get('a2')?.status).toBe('queued');
		await vi.advanceTimersByTimeAsync(REQUEUE_WAITS_MS[1]);
		expect(runs).toBe(3);
		expect(rows.get('a2')?.status).toBe('failed');
		expect(rows.get('a2')?.message).toMatch(/Tentei 3 vezes/);
	});

	it('never repeats a run that died after it may have sent the application', async () => {
		vi.useFakeTimers();
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		rows.set('a4', { status: 'applying', message: '' });
		let runs = 0;
		const paused: string[] = [];
		setRunner(
			async () => {
				runs++;
				throw new MaybeSubmitted('Connection error.');
			},
			(id) => paused.push(id)
		);
		enqueue('u1', 'a4');
		await vi.advanceTimersByTimeAsync(10);
		expect(rows.get('a4')).toEqual({
			status: 'needs_user',
			message: MAYBE_SUBMITTED_MESSAGE,
			needsKind: 'browser'
		});
		expect(paused).toEqual(['a4']);
		// However long it waits, it is not run again on its own.
		await vi.advanceTimersByTimeAsync(REQUEUE_WAITS_MS[0] + REQUEUE_WAITS_MS[1] + 60_000);
		expect(runs).toBe(1);
		expect(rows.get('a4')?.status).toBe('needs_user');
	});

	it('fails at once on an error that is not a passing one', async () => {
		vi.useFakeTimers();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		rows.set('a3', { status: 'queued', message: '' });
		setRunner(async () => {
			throw new Error('bug');
		});
		enqueue('u1', 'a3');
		await vi.advanceTimersByTimeAsync(10);
		expect(rows.get('a3')?.status).toBe('failed');
	});
});
