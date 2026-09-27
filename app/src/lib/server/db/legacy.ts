import { existsSync, renameSync } from 'node:fs';
import { getTableColumns, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { env } from '$env/dynamic/private';
import { db } from './index';
import * as t from './schema';

/** Parents before children, so foreign keys hold during the copy. */
const TABLES: [string, PgTable][] = [
	['campaign', t.campaign],
	['player', t.player],
	['warband', t.warband],
	['game', t.game],
	['adjustment', t.adjustment],
	['region_weather', t.regionWeather],
	['fx_state', t.fxState],
	['zone_lore', t.zoneLore],
	['unit', t.unit],
	['warband_stash', t.warbandStash],
	['model', t.model]
];

/** SQLite stored flags as 0/1, times as epoch ms and JSON as text; Postgres wants the real types. */
function convert(table: PgTable, row: Record<string, unknown>) {
	const out: Record<string, unknown> = {};
	for (const [key, col] of Object.entries(getTableColumns(table))) {
		if (!(col.name in row)) continue;
		const v = row[col.name];
		if (v === null || v === undefined) out[key] = v;
		else if (col.columnType === 'PgBoolean') out[key] = v === 1 || v === true;
		else if (col.columnType === 'PgTimestamp') out[key] = new Date(Number(v));
		else if (col.columnType === 'PgJsonb') out[key] = typeof v === 'string' ? JSON.parse(v) : v;
		else out[key] = v;
	}
	return out;
}

/**
 * One-time move from the old SQLite file (before Postgres). Runs only when Postgres holds no
 * campaign yet and the old file exists; afterwards the file is renamed so it never runs twice.
 */
export async function importLegacySqlite() {
	const path = env.LEGACY_SQLITE ?? '/data/campaign.db';
	if (!existsSync(path)) return;
	const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(t.campaign);
	if (n > 0) return;

	const { default: Database } = await import('better-sqlite3');
	const lite = new Database(path);
	// Fold any pending write-ahead log into the file first, so recent changes come across too.
	lite.pragma('wal_checkpoint(TRUNCATE)');
	const has = (name: string) =>
		!!lite.prepare(`select 1 from sqlite_master where type = 'table' and name = ?`).get(name);
	let copied = 0;
	await db.transaction(async (tx) => {
		for (const [name, table] of TABLES) {
			if (!has(name)) continue;
			const rows = lite.prepare(`select * from "${name}"`).all() as Record<string, unknown>[];
			for (const row of rows) await tx.insert(table).values(convert(table, row));
			copied += rows.length;
		}
	});
	lite.close();
	renameSync(path, `${path}.imported`);
	for (const extra of ['-wal', '-shm']) if (existsSync(path + extra)) renameSync(path + extra, `${path}.imported${extra}`);
	console.log(`Imported ${copied} rows from ${path} into Postgres (old file kept as ${path}.imported).`);
}
