/**
 * The request pipeline.
 * - Start-up (once): check settings, wait for the database, back up and migrate, log "Setup is open at <address>"
 *   while no owner exists, listen on the port saved in settings (custom server only), start the background jobs.
 * - Every request: request id, readiness gate (503 while starting or shutting down), cross-site check, setup guard
 *   (while no owner exists pages lead to /welcome and the API answers 409; afterwards /welcome and /setup lead to
 *   /login), session, forced password change, security headers, one access-log line, error mapping.
 */
import { redirect } from '@sveltejs/kit';
import type { Handle, HandleServerError, ServerInit } from '@sveltejs/kit/hooks';
import { randomUUID } from 'node:crypto';
import { config } from '#lib/server/infra/config';
import { logger } from '#lib/server/infra/logger';
import { closeDb, waitForDb } from '#lib/server/db';
import { migrated, runMigrations } from '#lib/server/infra/migrate';
import { startJobs, stopJobs } from '#lib/server/infra/jobs';
import { housekeeping } from '#lib/server/jobs';
import * as backups from '#lib/server/services/backups';
import { isSetupOpen, logSetupOpen } from '#lib/server/services/setup';
import { listenOnSavedPort } from '#lib/server/services/settings';
import { resolveSession } from '#lib/server/services/auth';
import { isCrossSite, isHttps, SESSION_COOKIE, setSessionCookie } from '#lib/server/http';
import { setupGuard } from '#lib/server/http/setup-guard';
import { AppError, errorBody } from '#lib/server/errors';

let shuttingDown = false;

/** An AppError as a JSON response in the shared error shape. */
function errorResponse(e: AppError, requestId: string) {
	const { status, body } = errorBody(e, requestId);
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

export const init: ServerInit = async () => {
	const c = config();
	logger.level = c.LOG_LEVEL;
	if (!c.RUN_STARTUP) return;
	await waitForDb();
	await runMigrations(() =>
		backups
			.dump('pre-migrate')
			.catch((e) => logger.error({ err: e }, 'Backup before migrating failed; migrating anyway'))
	);
	await logSetupOpen();
	await listenOnSavedPort();
	startJobs(housekeeping());
	process.once('sveltekit:shutdown', async () => {
		shuttingDown = true;
		stopJobs();
		await closeDb();
	});
	process.once('SIGTERM', () => (shuttingDown = true));
};

/** Ids from clients are kept only when short and plain. */
const requestIdOf = (h: string | null) => (h && /^[\w.-]{1,64}$/.test(h) ? h : randomUUID());

const isReady = () => !shuttingDown && (migrated() || !config().RUN_STARTUP);

const SECURITY_HEADERS: Record<string, string> = {
	'x-content-type-options': 'nosniff',
	'x-frame-options': 'DENY',
	'referrer-policy': 'same-origin',
	'permissions-policy': 'camera=(), microphone=(), geolocation=()'
};

export const handle: Handle = async ({ event, resolve }) => {
	const start = Date.now();
	event.locals.requestId = requestIdOf(event.request.headers.get('x-request-id'));
	event.locals.user = null;
	const path = event.url.pathname;

	const guard =
		isReady() && !path.startsWith('/health/')
			? setupGuard(path, event.request.method, await isSetupOpen())
			: null;
	if (guard && 'redirect' in guard) redirect(303, guard.redirect);

	let response: Response;
	if (!isReady() && !path.startsWith('/health/')) {
		const { body } = errorBody(null, event.locals.requestId);
		body.error = {
			code: 'unavailable',
			message: shuttingDown
				? 'The app is shutting down.'
				: 'The app is starting. Try again in a moment.',
			requestId: event.locals.requestId
		};
		response = new Response(JSON.stringify(body), {
			status: 503,
			headers: { 'content-type': 'application/json', 'retry-after': '5' }
		});
	} else if (isCrossSite(event.request)) {
		response = errorResponse(
			new AppError('forbidden', 'Requests from other sites are not allowed.'),
			event.locals.requestId
		);
	} else if (guard) {
		response = errorResponse(
			new AppError('conflict', 'Setup is not done yet.'),
			event.locals.requestId
		);
	} else {
		if (!path.startsWith('/health/')) {
			const found = await resolveSession(event.cookies.get(SESSION_COOKIE)).catch((e) => {
				logger.error({ err: e, requestId: event.locals.requestId }, 'Session lookup failed');
				return null;
			});
			if (found) {
				event.locals.user = found.user;
				if (found.renew) setSessionCookie(event, found.renew);
			}
		}
		// A temporary password must be changed before anything else (pages only; the API reports it per call).
		const u = event.locals.user;
		if (
			u?.mustChangePassword &&
			event.request.method === 'GET' &&
			!path.startsWith('/api/') &&
			!path.startsWith('/account/password') &&
			path !== '/logout'
		)
			redirect(303, '/account/password');
		response = await resolve(event);
	}

	response.headers.set('x-request-id', event.locals.requestId);
	for (const [k, v] of Object.entries(SECURITY_HEADERS))
		if (!response.headers.has(k)) response.headers.set(k, v);
	// Browsers ignore (and warn about) this header on plain HTTP, the usual LAN install.
	if (isHttps(event)) response.headers.set('cross-origin-opener-policy', 'same-origin');
	if (!path.startsWith('/health/'))
		logger.info(
			{
				requestId: event.locals.requestId,
				method: event.request.method,
				route: event.route.id ?? path,
				status: response.status,
				ms: Date.now() - start,
				userId: event.locals.user?.id
			},
			'request'
		);
	return response;
};

export const handleError: HandleServerError = (input) => {
	const requestId = input.event.locals.requestId ?? 'unknown';
	// Unknown errors are bugs: log them in full, show people only a request id to quote.
	if (input.kind === 'unknown') {
		logger.error({ err: input.error, requestId, route: input.event.route.id }, 'Unhandled error');
		return {
			message: 'Something went wrong. Quote the request id when asking for help.',
			requestId
		};
	}
	return { requestId } as App.Error;
};
