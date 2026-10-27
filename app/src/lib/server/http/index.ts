/**
 * HTTP helpers shared by pages and the API, so every route does the same three things: build the context, parse
 * input with a zod schema, and turn an AppError into the one error shape (API) or a form failure (pages).
 */
import { fail, json, type RequestEvent } from '@sveltejs/kit';
import type { z } from 'zod';
import { AppError, errorBody, fieldsOf } from '../errors';
import type { Ctx, SessionUser } from '../services/audit';
import { logger } from '../infra/logger';

const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const FORM_TYPES = ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'];

/**
 * A write sent by another site, refused before anything runs. The browser's Origin must name the host it asked for
 * (Host): this works for every address a group reaches the app by (localhost, a LAN address, a domain). Kit's own
 * check is switched off (`csrf.trustedOrigins: ['*']`) because without a build-time origin it assumes https and
 * refuses every form on plain HTTP. A request without Origin is refused only if a browser form could have sent it.
 */
export function isCrossSite(request: Request) {
	if (!WRITES.has(request.method)) return false;
	const origin = request.headers.get('origin');
	if (!origin) {
		const type = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
		return FORM_TYPES.includes(type);
	}
	try {
		return new URL(origin).host !== request.headers.get('host');
	} catch {
		return true;
	}
}

/** Whether the browser is on HTTPS: Caddy says so in X-Forwarded-Proto; a direct connection is plain HTTP. */
export const isHttps = (event: RequestEvent) =>
	event.request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https';

/** Who is acting, from where, for which request. */
export function ctxOf(event: RequestEvent): Ctx {
	let ip: string | null;
	try {
		ip = event.getClientAddress();
	} catch {
		ip = null;
	}
	return {
		actor: event.locals.user,
		ip,
		userAgent: event.request.headers.get('user-agent'),
		requestId: event.locals.requestId,
		host: event.request.headers.get('host')
	};
}

/** The session cookie: httpOnly, SameSite=Lax, Secure over HTTPS. */
export const SESSION_COOKIE = 'fl_session';

export function setSessionCookie(event: RequestEvent, s: { token: string; maxAge: number | null }) {
	event.cookies.set(SESSION_COOKIE, s.token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: isHttps(event),
		...(s.maxAge ? { maxAge: s.maxAge } : {})
	});
}

export const clearSessionCookie = (event: RequestEvent) =>
	event.cookies.delete(SESSION_COOKIE, { path: '/' });

/** Parse with a schema or throw `invalid` with field messages. */
export function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
	const r = schema.safeParse(value);
	if (!r.success)
		throw new AppError('invalid', 'Check the highlighted fields.', fieldsOf(r.error.issues));
	return r.data;
}

// ---------------------------------------------------------------- the JSON API

type Handler = (event: RequestEvent, ctx: Ctx) => Promise<Response | unknown>;

/**
 * Wrap an API handler: writes must send JSON (other sites are refused in the hook); the result becomes JSON; errors become the
 * one error shape with the request id. `role` requires a signed-in account of at least that role.
 */
export function api(handler: Handler, opts: { auth?: boolean } = { auth: true }) {
	return async (event: RequestEvent) => {
		const requestId = event.locals.requestId;
		try {
			const write = !['GET', 'HEAD', 'OPTIONS'].includes(event.request.method);
			if (write) {
				const type = event.request.headers.get('content-type') ?? '';
				const hasBody =
					event.request.headers.get('content-length') !== '0' && event.request.body !== null;
				if (hasBody && !type.startsWith('application/json'))
					throw new AppError('invalid', 'Send JSON (Content-Type: application/json).');
			}
			if (opts.auth !== false && !event.locals.user)
				throw new AppError('unauthenticated', 'Sign in first.');
			const out = await handler(event, ctxOf(event));
			return out instanceof Response ? out : json(out ?? null);
		} catch (e) {
			const { status, body, retryAfter } = errorBody(e, requestId);
			if (status >= 500) logger.error({ err: e, requestId }, 'API error');
			return json(body, {
				status,
				headers: retryAfter ? { 'retry-after': String(retryAfter) } : {}
			});
		}
	};
}

/** The JSON body of a request, parsed with a schema. */
export async function body<S extends z.ZodType>(
	event: RequestEvent,
	schema: S
): Promise<z.infer<S>> {
	let value: unknown;
	try {
		value = await event.request.json();
	} catch {
		throw new AppError('invalid', 'The body is not valid JSON.');
	}
	return parse(schema, value);
}

// ---------------------------------------------------------------- pages and form actions

/** The form's fields as a plain object (checkboxes absent when unticked). */
export const formObject = async (event: RequestEvent) =>
	Object.fromEntries(await event.request.formData());

/**
 * Run a form action: parse the form with a schema, call the service, and turn an AppError into `fail()` with the
 * message, the field messages and the values typed (never passwords).
 */
export async function formAction<S extends z.ZodType, T>(
	event: RequestEvent,
	schema: S,
	run: (data: z.infer<S>, ctx: Ctx) => Promise<T>
) {
	const raw = await formObject(event);
	const values = Object.fromEntries(
		Object.entries(raw).filter(([k]) => !/password|current/i.test(k))
	);
	try {
		return await run(parse(schema, raw), ctxOf(event));
	} catch (e) {
		if (e instanceof AppError)
			return fail(e.status, { message: e.message, fields: e.fields ?? {}, values, code: e.code });
		throw e;
	}
}

export type { SessionUser };
