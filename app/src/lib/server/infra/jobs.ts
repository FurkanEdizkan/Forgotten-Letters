/**
 * Background jobs on an in-process timer. Each run takes a Postgres advisory lock, so only one runner works even if
 * the app ever runs twice; a failed run logs and tries again next time.
 */
import { sqlClient } from '../db';
import { logger } from './logger';

export interface Job {
	name: string;
	everyMs: number;
	lock: number;
	run: () => Promise<Record<string, unknown> | void>;
}

const timers: NodeJS.Timeout[] = [];

async function tick(job: Job) {
	const sql = sqlClient();
	try {
		const [row] = await sql<{ ok: boolean }[]>`select pg_try_advisory_lock(${job.lock}) as ok`;
		if (!row?.ok) return;
		try {
			const t = Date.now();
			const counts = await job.run();
			logger.info({ job: job.name, ms: Date.now() - t, ...(counts ?? {}) }, 'Job done');
		} finally {
			await sql`select pg_advisory_unlock(${job.lock})`;
		}
	} catch (e) {
		logger.error({ job: job.name, err: e }, 'Job failed; it runs again next time');
	}
}

export function startJobs(jobs: Job[]) {
	for (const job of jobs) {
		setTimeout(() => tick(job), 30_000).unref();
		timers.push(setInterval(() => tick(job), job.everyMs).unref());
	}
}

export function stopJobs() {
	for (const t of timers.splice(0)) clearInterval(t);
}
