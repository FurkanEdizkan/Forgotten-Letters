import { json } from '@sveltejs/kit';

/**
 * Liveness: the process is up and answering. No database call.
 * Who: anyone (Docker's healthcheck).
 * Out: 200 { status: "ok" }.
 */
export const GET = () => json({ status: 'ok' });
