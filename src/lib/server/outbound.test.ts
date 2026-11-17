import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// What happens to the calls that leave the machine when the network fails:
// the fetch underneath the real SDKs is replaced, nothing else.

process.env.RESEND_API_KEY = 're_test';
process.env.EMAIL_FROM = 'WOK <wok@example.com>';
process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
process.env.APIFY_TOKEN = 'apify_test';

const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
const offline = () => Promise.reject(new TypeError('fetch failed'));

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	fetchMock = vi.fn();
	vi.stubGlobal('fetch', fetchMock);
	vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

/** Lets the waits between attempts pass without spending them. */
async function settle<T>(promise: Promise<T>) {
	const outcome = promise.then(
		(value) => ({ value }),
		(error: unknown) => ({ error })
	);
	await vi.runAllTimersAsync();
	return outcome as Promise<{ value?: T; error?: unknown }>;
}

describe('email', () => {
	it('is sent on the third attempt when the first two cannot reach the service', async () => {
		vi.useFakeTimers();
		const { sendMagicLinkEmail } = await import('./email.ts');
		fetchMock
			.mockImplementationOnce(offline)
			.mockImplementationOnce(() =>
				Promise.resolve(json(503, { statusCode: 503, name: 'application_error', message: 'down' }))
			)
			.mockImplementation(() => Promise.resolve(json(200, { id: 'e1' })));
		const { error } = await settle(sendMagicLinkEmail('a@example.com', 'https://wok.test/x'));
		expect(error).toBeUndefined();
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it('gives up as unavailable after the first attempt and three more', async () => {
		vi.useFakeTimers();
		const { sendNeedsUserEmail, EmailUnavailable } = await import('./email.ts');
		fetchMock.mockImplementation(offline);
		const { error } = await settle(
			sendNeedsUserEmail('a@example.com', {
				company: 'C',
				title: 'T',
				reason: 'R',
				url: 'https://w'
			})
		);
		expect(error).toBeInstanceOf(EmailUnavailable);
		expect(fetchMock).toHaveBeenCalledTimes(4);
	});

	it('does not insist on a request the service refused (4xx)', async () => {
		vi.useFakeTimers();
		const { sendMagicLinkEmail, EmailUnavailable } = await import('./email.ts');
		fetchMock.mockImplementation(() =>
			Promise.resolve(
				json(422, { statusCode: 422, name: 'validation_error', message: 'Invalid `to` field.' })
			)
		);
		const { error } = await settle(sendMagicLinkEmail('nope', 'https://wok.test/x'));
		expect(error).toBeInstanceOf(Error);
		expect(error).not.toBeInstanceOf(EmailUnavailable);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

describe('model', () => {
	it('answers after two dropped connections, without the caller noticing', async () => {
		const { z } = await import('zod');
		const { structured } = await import('./agent/llm.ts');
		fetchMock
			.mockImplementationOnce(offline)
			.mockImplementationOnce(offline)
			.mockImplementation(() =>
				Promise.resolve(
					json(200, {
						id: 'msg_1',
						type: 'message',
						role: 'assistant',
						model: 'claude-sonnet-5-5',
						content: [{ type: 'text', text: '{"ok":true}' }],
						stop_reason: 'end_turn',
						stop_sequence: null,
						usage: { input_tokens: 1, output_tokens: 1 }
					})
				)
			);
		const out = await structured({ schema: z.object({ ok: z.boolean() }), system: 's', user: 'u' });
		expect(out).toEqual({ ok: true });
		expect(fetchMock).toHaveBeenCalledTimes(3);
	}, 30_000);
});

describe('transient failures', () => {
	it('tells a passing failure from a refused request', async () => {
		const { isTransient } = await import('./retry.ts');
		const { default: Anthropic } = await import('@anthropic-ai/sdk');
		expect(isTransient(new Anthropic.APIConnectionError({ message: 'Connection error.' }))).toBe(
			true
		);
		expect(isTransient(new Anthropic.APIConnectionTimeoutError())).toBe(true);
		expect(isTransient(Object.assign(new Error('x'), { status: 503 }))).toBe(true);
		expect(
			isTransient(
				new TypeError('fetch failed', {
					cause: Object.assign(new Error('dns'), { code: 'EAI_AGAIN' })
				})
			)
		).toBe(true);
		expect(isTransient(Object.assign(new Error('getaddrinfo'), { code: 'ENOTFOUND' }))).toBe(true);
		expect(isTransient(Object.assign(new Error('bad'), { status: 400 }))).toBe(false);
		expect(isTransient(Object.assign(new Error('auth'), { statusCode: 401 }))).toBe(false);
		expect(isTransient(new Error('Resposta do modelo incompleta'))).toBe(false);
	});
});
