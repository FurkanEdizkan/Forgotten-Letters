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
		expect(await migrationState()).toEqual({ total: 10, applied: 0 });
		expect(migrated()).toBe(false);

		let backups = 0;
		await runMigrations(async () => backups++);
		expect(await migrationState()).toEqual({ total: 10, applied: 10 });
		expect(migrated()).toBe(true);
		expect(backups).toBe(0); // nothing to back up in an empty database

		await runMigrations(async () => backups++);
		expect(await migrationState()).toEqual({ total: 10, applied: 10 });
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
	it('upgrading from step 2: campaigns get core-1.0.2, Carcass Front ones also its expansion', async () => {
		pointAppAt(await createDatabase());
		await drizzleMigrate(db(), { migrationsFolder: olderRelease(5) });
		const sql = sqlClient();
		const [u] =
			await sql`insert into auth.users (username, display_name, password_hash, role) values ('old.cm2', 'CM', 'x', 'admin') returning id`;
		await sql`insert into campaign.campaigns (name, kind, visibility, created_by) values ('Front', 'carcass_front', 'private', ${u!.id}), ('Other', 'generic', 'private', ${u!.id})`;
		await runMigrations();
		const rows =
			await sql`select name, rules_set, rules_expansions from campaign.campaigns order by name`;
		expect(rows.map((r) => ({ ...r }))).toEqual([
			{ name: 'Front', rules_set: 'core-1.0.2', rules_expansions: ['carcass-front-1.0'] },
			{ name: 'Other', rules_set: 'core-1.0.2', rules_expansions: [] }
		]);
		const [cache] = await sql`select count(*)::int as n from rules.sets`;
		expect(cache!.n).toBe(0);
	});
	it('upgrading from step 3: seats have no warband, campaigns keep their limits', async () => {
		pointAppAt(await createDatabase());
		await drizzleMigrate(db(), { migrationsFolder: olderRelease(6) });
		const sql = sqlClient();
		const [u] =
			await sql`insert into auth.users (username, display_name, password_hash, role) values ('old.cm3', 'CM', 'x', 'admin') returning id`;
		const [c] =
			await sql`insert into campaign.campaigns (name, kind, visibility, created_by) values ('Mire', 'generic', 'private', ${u!.id}) returning id`;
		await sql`insert into campaign.seats (campaign_id, number, name, user_id, joined_at) values (${c!.id}, 1, 'Seat 1', ${u!.id}, now())`;
		await runMigrations();
		const [seat] = await sql`select warband_id from campaign.seats`;
		expect(seat!.warband_id).toBeNull();
		const [camp] = await sql`select allow_beyond_limits from campaign.campaigns`;
		expect(camp!.allow_beyond_limits).toBe(false);
		const [w] =
			await sql`insert into warband.warbands (owner_id, name, rules_set, faction_id, ducat_limit) values (${u!.id}, 'Old Lanterns', 'core-1.0.2', 'faction:lantern-guild', 700) returning version, stash, updated_at`;
		expect(w).toMatchObject({ version: 1, stash: [] });
	});
	it('upgrading from before homebrew: campaigns allow none; a set keeps updated_at current', async () => {
		pointAppAt(await createDatabase());
		await drizzleMigrate(db(), { migrationsFolder: olderRelease(7) });
		const sql = sqlClient();
		const [u] =
			await sql`insert into auth.users (username, display_name, password_hash, role) values ('old.cm4', 'CM', 'x', 'admin') returning id`;
		await sql`insert into campaign.campaigns (name, kind, visibility, created_by) values ('Fen', 'generic', 'private', ${u!.id})`;
		await runMigrations();
		const [camp] = await sql`select homebrew_sets from campaign.campaigns`;
		expect(camp!.homebrew_sets).toEqual([]);
		const [h] =
			await sql`insert into homebrew.homebrew_sets (owner_id, name, kind, base_set, data) values (${u!.id}, 'Fen Kin', 'faction', 'core-1.0.2', '{}') returning id, visibility, report, last_good, updated_at`;
		expect(h).toMatchObject({ visibility: 'private', report: [], last_good: null });
		const [after] =
			await sql`update homebrew.homebrew_sets set name = 'Fen Folk' where id = ${h!.id} returning updated_at`;
		expect(new Date(after!.updated_at).getTime()).toBeGreaterThanOrEqual(
			new Date(h!.updated_at).getTime()
		);
		await expect(
			sql`insert into homebrew.homebrew_sets (owner_id, name, kind, base_set, data) values (${u!.id}, '', 'faction', 'core-1.0.2', '{}')`
		).rejects.toThrow(/homebrew_sets_name_length/);
	});
	it('upgrading from step 4: the Dead group becomes the dead status; Court Sins become a dedication', async () => {
		pointAppAt(await createDatabase());
		await drizzleMigrate(db(), { migrationsFolder: olderRelease(8) });
		const sql = sqlClient();
		const [u] =
			await sql`insert into auth.users (username, display_name, password_hash, role) values ('old.player', 'P', 'x', 'user') returning id`;
		const [court] =
			await sql`insert into warband.warbands (owner_id, name, rules_set, faction_id, variant_id, ducat_limit) values (${u!.id}, 'Gilded Maw', 'core-1.0.2', 'faction:seven-headed-serpent', 'variant:seven-headed-serpent/greed', 700) returning id`;
		const [other] =
			await sql`insert into warband.warbands (owner_id, name, rules_set, faction_id, variant_id, ducat_limit) values (${u!.id}, 'Salt Choir', 'core-1.0.2', 'faction:new-antioch', 'variant:new-antioch/eire-rangers', 700) returning id`;
		await sql`insert into warband.fighters (warband_id, unit_id, grp, sort) values (${other!.id}, 'unit:new-antioch/yeoman', 'dead', 1), (${other!.id}, 'unit:new-antioch/yeoman', 'troop', 2)`;
		await runMigrations();
		const ws =
			await sql`select id, variant_id, dedication, games_played, victory_points, failed_promotions, ignore_limits from warband.warbands order by name`;
		expect(ws).toEqual([
			{
				id: court!.id,
				variant_id: null,
				dedication: 'greed',
				games_played: 0,
				victory_points: 0,
				failed_promotions: 0,
				ignore_limits: false
			},
			{
				id: other!.id,
				variant_id: 'variant:new-antioch/eire-rangers',
				dedication: null,
				games_played: 0,
				victory_points: 0,
				failed_promotions: 0,
				ignore_limits: false
			}
		]);
		const fs = await sql`select grp, status, battle_scars from warband.fighters order by sort`;
		expect(fs).toEqual([
			{ grp: 'dead', status: 'dead', battle_scars: 0 },
			{ grp: 'troop', status: 'active', battle_scars: 0 }
		]);
	});
	it('upgrading from revision 2: warbands stay as they are; card frames start empty, one per target', async () => {
		pointAppAt(await createDatabase());
		await drizzleMigrate(db(), { migrationsFolder: olderRelease(9) });
		const sql = sqlClient();
		const [u] =
			await sql`insert into auth.users (username, display_name, password_hash, role) values ('old.owner', 'O', 'x', 'owner') returning id`;
		await sql`insert into warband.warbands (owner_id, name, rules_set, faction_id, ducat_limit) values (${u!.id}, 'Salt Choir', 'core-1.0.2', 'faction:new-antioch', 700)`;
		await runMigrations();
		expect(await sql`select name from warband.warbands`).toEqual([{ name: 'Salt Choir' }]);
		expect(await sql`select * from warband.card_frames`).toEqual([]);
		const [f] =
			await sql`insert into warband.card_frames (target, updated_by) values ('faction:new-antioch', ${u!.id}) returning version`;
		expect(f).toEqual({ version: 1 });
		await expect(
			sql`insert into warband.card_frames (target) values ('faction:new-antioch')`
		).rejects.toThrow(/card_frames_target_unique/);
		await sql`delete from auth.users where id = ${u!.id}`;
		expect(await sql`select updated_by from warband.card_frames`).toEqual([{ updated_by: null }]);
	});
});
