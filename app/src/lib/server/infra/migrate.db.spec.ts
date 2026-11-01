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
		expect(await migrationState()).toEqual({ total: 5, applied: 0 });
		expect(migrated()).toBe(false);

		let backups = 0;
		await runMigrations(async () => backups++);
		expect(await migrationState()).toEqual({ total: 5, applied: 5 });
		expect(migrated()).toBe(true);
		expect(backups).toBe(0); // nothing to back up in an empty database

		await runMigrations(async () => backups++);
		expect(await migrationState()).toEqual({ total: 5, applied: 5 });
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
	it('upgrading from step 2: old house rules become the CM’s own, open seat links keep their expiry', async () => {
		pointAppAt(await createDatabase());
		await drizzleMigrate(db(), { migrationsFolder: olderRelease(4) });
		const sql = sqlClient();
		const [u] =
			await sql`insert into auth.users (username, display_name, password_hash, role) values ('old.cm', 'CM', 'x', 'admin') returning id`;
		const [c] =
			await sql`insert into campaign.campaigns (name, kind, visibility, created_by, house_rules) values ('Old', 'generic', 'private', ${u!.id}, ${'[{"name":"Short nights","text":"","on":true}]'}::jsonb) returning id`;
		const [seat] =
			await sql`insert into campaign.seats (campaign_id, number, name) values (${c!.id}, 1, 'Seat 1') returning id`;
		await sql`insert into campaign.seat_invites (seat_id, token_hash, created_by) values (${seat!.id}, 'h', ${u!.id})`;
		await runMigrations();
		const [after] = await sql`select house_rules from campaign.campaigns where id = ${c!.id}`;
		expect(after!.house_rules).toEqual([
			{ name: 'Short nights', text: '', on: true, kind: 'passive', preset: null, values: {} }
		]);
		const [link] =
			await sql`select expires_at is not null as dated, token_enc from campaign.seat_invites`;
		expect(link).toEqual({ dated: true, token_enc: null });
	});
});
