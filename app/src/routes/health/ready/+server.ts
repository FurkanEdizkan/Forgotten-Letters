import { json } from '@sveltejs/kit';
import { ping } from '#lib/server/db';
import { migrated } from '#lib/server/infra/migrate';
import { config } from '#lib/server/infra/config';

/**
 * Readiness: the database answers and every migration is applied.
 * Who: anyone (Caddy, the CI smoke test, people); version details only for a signed-in owner.
 * Out: 200 { status: "ready", database: true, migrated: true } or 503 with the same fields.
 * Errors: 503 while starting, after SIGTERM, or when the database is down.
 */
export const GET = async ({ locals }) => {
	const database = await ping();
	const ready = database && (migrated() || !config().RUN_STARTUP);
	const body: Record<string, unknown> = {
		status: ready ? 'ready' : 'not-ready',
		database,
		migrated: migrated()
	};
	if (locals.user?.role === 'owner') body.version = process.env.APP_VERSION ?? 'dev';
	return json(body, { status: ready ? 200 : 503 });
};
