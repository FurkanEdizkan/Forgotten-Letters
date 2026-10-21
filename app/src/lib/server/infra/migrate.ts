/**
 * Migrations at start: forward-only SQL from drizzle/, applied in order under an advisory lock (so two starts never
 * race). When migrations are pending and the database already holds data, a pg_dump is written first.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { migrate as drizzleMigrate } from 'drizzle-orm/postgres-js/migrator';
import { db, sqlClient } from '../db';
import { logger } from './logger';

const LOCK = 7_314_001;
export const MIGRATIONS = resolve(process.env.MIGRATIONS_DIR ?? 'drizzle');

/** Migrations in the folder, and how many the database has applied. */
export async function migrationState() {
	const journal = JSON.parse(readFileSync(resolve(MIGRATIONS, 'meta/_journal.json'), 'utf8')) as {
		entries: unknown[];
	};
	const sql = sqlClient();
	const [row] = await sql<
		{ exists: boolean }[]
	>`select to_regclass('drizzle.__drizzle_migrations') is not null as exists`;
	const exists = !!row?.exists;
	const applied = exists
		? Number((await sql`select count(*)::int as n from drizzle.__drizzle_migrations`)[0]!.n)
		: 0;
	return { total: journal.entries.length, applied };
}

let ready = false;
/** Have all migrations been applied (readiness)? */
export const migrated = () => ready;

/** Apply pending migrations; `beforeMigrate` runs (e.g. a backup) only when there is something to apply to a database in use. */
export async function runMigrations(beforeMigrate?: () => Promise<unknown>) {
	const sql = sqlClient();
	await sql`select pg_advisory_lock(${LOCK})`;
	try {
		const { total, applied } = await migrationState();
		if (total > applied) {
			if (applied > 0 && beforeMigrate) await beforeMigrate();
			const t = Date.now();
			await drizzleMigrate(db(), { migrationsFolder: MIGRATIONS });
			logger.info({ applied: total - applied, ms: Date.now() - t }, 'Migrations applied');
		}
		ready = true;
	} finally {
		await sql`select pg_advisory_unlock(${LOCK})`;
	}
}
