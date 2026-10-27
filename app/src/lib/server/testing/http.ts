/**
 * API tests without a server: `call` runs a `+server.ts` handler with a minimal RequestEvent (JSON body, the
 * signed-in account in locals, a cookie jar), the way the hook would after it resolved the session.
 */
import type { RequestEvent } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import type { SessionUser } from '../services/audit';

type Handler = (event: RequestEvent) => Promise<Response>;

export async function call(
	handler: Handler,
	opts: { method?: string; body?: unknown; user?: SessionUser | null; host?: string } = {}
) {
	const method = opts.method ?? 'GET';
	const host = opts.host ?? 'localhost:3000';
	const headers: Record<string, string> = {
		host,
		origin: `http://${host}`,
		'user-agent': 'vitest'
	};
	if (opts.body !== undefined) headers['content-type'] = 'application/json';
	const request = new Request(`http://${host}/api/v1`, {
		method,
		headers,
		body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
	});
	const cookies = new Map<string, string>();
	const event = {
		request,
		url: new URL(request.url),
		params: {},
		locals: { requestId: randomUUID(), user: opts.user ?? null },
		cookies: {
			get: (name: string) => cookies.get(name),
			set: (name: string, value: string) => void cookies.set(name, value),
			delete: (name: string) => void cookies.delete(name)
		},
		getClientAddress: () =>
			`10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`
	} as unknown as RequestEvent;
	const res = await handler(event);
	const text = await res.text();
	return { status: res.status, body: text ? JSON.parse(text) : null, cookies };
}
