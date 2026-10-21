import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, sqlClient } from '../db';
import { createDatabase, pointAppAt } from '../testing/db';
import { migrated, migrationState, runMigrations } from './migrate';

beforeAll(async () => pointAppAt(await createDatabase()));
afterAll(closeDb);

describe('migrations', () => {
	it('apply to an empty database, and applying again is a no-op', async () => {
		expect(await migrationState()).toEqual({ total: 2, applied: 0 });
		expect(migrated()).toBe(false);

		let backups = 0;
		await runMigrations(async () => backups++);
		expect(await migrationState()).toEqual({ total: 2, applied: 2 });
		expect(migrated()).toBe(true);
		expect(backups).toBe(0); // nothing to back up in an empty database

		await runMigrations(async () => backups++);
		expect(await migrationState()).toEqual({ total: 2, applied: 2 });
		expect(backups).toBe(0);

		const tables =
			await sqlClient()`select table_name from information_schema.tables where table_schema = 'auth' order by table_name`;
		expect(tables.map((t) => t.table_name)).toEqual([
			'audit_log',
			'invites',
			'sessions',
			'setup_tokens',
			'users'
		]);
	});
	it('two starts at once both finish without error', async () => {
		await expect(Promise.all([runMigrations(), runMigrations()])).resolves.toHaveLength(2);
	});
});
