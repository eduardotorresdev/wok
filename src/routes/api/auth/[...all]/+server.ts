import { toSvelteKitHandler } from 'better-auth/svelte-kit';
import type { RequestHandler } from './$types';
import { auth } from '#lib/server/auth.ts';

// The hook already routes /api/auth/* to Better Auth; this keeps the route
// visible in the tree and covers the case where the hook order changes.
const handler: RequestHandler = (event) => toSvelteKitHandler(auth())(event);

export const GET = handler;
export const POST = handler;
