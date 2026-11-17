import { json, type RequestEvent } from '@sveltejs/kit';
import type { z } from 'zod';

/** Error carried up to the route wrapper and rendered as {error:{code,message}}. */
export class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string,
		/** Extra fields for the error object, e.g. which provider blocked the action. */
		public extra: Record<string, unknown> = {}
	) {
		super(message);
	}
}

export function apiError(
	status: number,
	code: string,
	message: string,
	extra: Record<string, unknown> = {}
) {
	return json({ error: { ...extra, code, message } }, { status });
}

export function requireUser(event: RequestEvent) {
	const user = event.locals.user;
	if (!user) throw new ApiError(401, 'unauthorized', 'Sessão necessária.');
	return user;
}

export async function parseBody<T extends z.ZodType>(
	event: RequestEvent,
	schema: T
): Promise<z.infer<T>> {
	let raw: unknown;
	try {
		raw = await event.request.json();
	} catch {
		throw new ApiError(400, 'invalid_json', 'Corpo da requisição não é JSON válido.');
	}
	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		const where = issue.path.length ? `${issue.path.join('.')}: ` : '';
		throw new ApiError(400, 'invalid_body', `${where}${issue.message}`);
	}
	return parsed.data;
}

/** Wraps a handler so every failure leaves as {error:{code,message}}. */
export function api<E extends RequestEvent>(handler: (event: E) => Promise<Response> | Response) {
	return async (event: E): Promise<Response> => {
		try {
			return await handler(event);
		} catch (err) {
			if (err instanceof ApiError) return apiError(err.status, err.code, err.message, err.extra);
			console.error(`[api] ${event.request.method} ${event.url.pathname}`, err);
			return apiError(500, 'internal_error', 'Erro interno. Tente novamente.');
		}
	};
}
