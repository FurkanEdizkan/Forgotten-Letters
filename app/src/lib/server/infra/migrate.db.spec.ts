import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate as drizzleMigrate } from 'drizzle-orm/postgres-js/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, db, sqlClient } from '../db';
import { createDatabase, pointAppAt } from '../testing/db';
import { MIGRATIONS, migrated, migrationState, runMigrations } from './migrate';

beforeAll(async () => pointAppAt(await createDatabase()));
afterAll(closeDb);

/** A copy of the migrations folder holding only the first `n` migrations (an older release). */
function olderRelease(n: number) {
	const dir = mkdtempSync(join(tmpdir(), 'fl-migrations-'));
	cpSync(MIGRATIONS, dir, { recursive: true });
	const journalPath = join(dir, 'meta/_journal.json');
	const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
	journal.entries = journal.entries.slice(0, n);
	writeFileSync(journalPath, JSON.stringify(journal));
	return dir;
}

describe('migrations', () => {
	it('apply to an empty database, and applying again is a no-op', async () => {
		expect(await migrationState()).toEqual({ total: 3, applied: 0 });
		expect(migrated()).toBe(false);

		let backups = 0;
		await runMigrations(async () => backups++);
		expect(await migrationState()).toEqual({ total: 3, applied: 3 });
		expect(migrated()).toBe(true);
		expect(backups).toBe(0); // nothing to back up in an empty database

		await runMigrations(async () => backups++);
		expect(await migrationState()).toEqual({ total: 3, applied: 3 });
		expect(backups).toBe(0);

		const tables =
			await sqlClient()`select table_name from information_schema.tables where table_schema = 'auth' order by table_name`;
		expect(tables.map((t) => t.table_name)).toEqual(['audit_log', 'invites', 'sessions', 'users']);
		const settings =
			await sqlClient()`select id, text_scale, accent, port, setup_completed_at from app.settings`;
		expect(settings).toEqual([
			{ id: 1, text_scale: 100, accent: 'blood', port: 3000, setup_completed_at: null }
		]);
	});
	it('two starts at once both finish without error', async () => {
		await expect(Promise.all([runMigrations(), runMigrations()])).resolves.toHaveLength(2);
	});
	it('upgrading a copy set up with the old setup link marks setup done and drops the old tokens', async () => {
		await closeDb();
		pointAppAt(await createDatabase());
		await drizzleMigrate(db(), { migrationsFolder: olderRelease(2) });
		const sql = sqlClient();
		await sql`insert into auth.users (username, display_name, password_hash, role) values ('old.owner', 'Old Owner', 'x', 'owner')`;
		await sql`insert into auth.setup_tokens (token_hash, expires_at) values ('h', now())`;
		await runMigrations();
		const [row] = await sql`select setup_completed_at is not null as done, port from app.settings`;
		expect(row).toEqual({ done: true, port: 3000 });
		const [old] = await sql`select to_regclass('auth.setup_tokens') is null as gone`;
		expect(old!.gone).toBe(true);
	});
});
