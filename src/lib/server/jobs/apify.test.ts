import { afterEach, describe, expect, it, vi } from 'vitest';

process.env.APIFY_TOKEN = 'apify_test';

const calls = { start: 0, wait: 0, list: 0 };
const plan: { start: unknown[]; wait: unknown[]; list: unknown[] } = {
	start: [],
	wait: [],
	list: []
};
const next = (step: keyof typeof plan, ok: unknown) => {
	calls[step]++;
	const failure = plan[step].shift();
	return failure ? Promise.reject(failure) : Promise.resolve(ok);
};
const dns = () =>
	Object.assign(new Error('getaddrinfo EAI_AGAIN api.apify.com'), { code: 'EAI_AGAIN' });

vi.mock('apify-client', () => ({
	ApifyClient: class {
		actor() {
			return { start: () => next('start', { id: 'run1' }) };
		}
		run() {
			return {
				waitForFinish: () => next('wait', { status: 'SUCCEEDED', defaultDatasetId: 'ds1' })
			};
		}
		dataset() {
			return { listItems: () => next('list', { items: [{ id: '1' }] }) };
		}
	}
}));

const { runActor } = await import('./apify.ts');

async function settle<T>(promise: Promise<T>) {
	const outcome = promise.then(
		(value) => ({ value, error: undefined }),
		(error: unknown) => ({ value: undefined, error })
	);
	await vi.runAllTimersAsync();
	return outcome;
}

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	calls.start = calls.wait = calls.list = 0;
	plan.start = [];
	plan.wait = [];
	plan.list = [];
});

describe('runActor', () => {
	it('gets through network failures without starting the actor twice', async () => {
		vi.useFakeTimers();
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		plan.wait = [dns(), dns()];
		plan.list = [Object.assign(new Error('bad gateway'), { statusCode: 502 })];
		const { value, error } = await settle(runActor('a/b', {}, 10));
		expect(error).toBeUndefined();
		expect(value).toEqual([{ id: '1' }]);
		expect(calls).toEqual({ start: 1, wait: 3, list: 2 });
	});

	it('fails only after every attempt', async () => {
		vi.useFakeTimers();
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		plan.start = [dns(), dns(), dns(), dns()];
		const { error } = await settle(runActor('a/b', {}, 10));
		expect((error as Error).message).toMatch(/EAI_AGAIN/);
		expect(calls.start).toBe(4);
	});

	it('does not insist on a refused request', async () => {
		vi.useFakeTimers();
		plan.start = [Object.assign(new Error('Actor not found'), { statusCode: 404 })];
		const { error } = await settle(runActor('a/b', {}, 10));
		expect((error as Error).message).toMatch(/not found/);
		expect(calls.start).toBe(1);
	});
});
