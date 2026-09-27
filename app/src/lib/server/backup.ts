import { eq, inArray } from 'drizzle-orm';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { db } from './db';
import {
	adjustment,
	campaign,
	fxState,
	game,
	model,
	player,
	regionWeather,
	unit,
	warband,
	warbandStash,
	zoneLore
} from './db/schema';
import { resolveUpload } from './uploads';

/** v2 adds lore, rosters and models (and their files); v1 backups still import. */
export const BACKUP_VERSION = 2;

type Row = Record<string, unknown>;

export interface Backup {
	app: 'carcass-front';
	version: number;
	exportedAt: string;
	campaign: Row;
	players: Row[];
	warbands: Row[];
	games: Row[];
	adjustments: Row[];
	regions: Row[];
	fx: Row[];
	lore?: Row[];
	units?: Row[];
	stash?: Row[];
	models?: Row[];
	/** Uploaded files (images and model STLs), base64, keyed by their /uploads path. */
	images: Record<string, string>;
}

/** Everything for one campaign, images included, as a single JSON document. */
export async function exportCampaign(campaignId: string): Promise<Backup> {
	const c = db.select().from(campaign).where(eq(campaign.id, campaignId)).get();
	if (!c) throw new Error('No campaign');
	const players = db.select().from(player).where(eq(player.campaignId, campaignId)).all();
	const warbands = db.select().from(warband).where(eq(warband.campaignId, campaignId)).all();

	const ids = warbands.map((w) => w.id);
	const lore = db.select().from(zoneLore).where(eq(zoneLore.campaignId, campaignId)).all();
	const units = ids.length ? db.select().from(unit).where(inArray(unit.warbandId, ids)).all() : [];
	const stash = ids.length ? db.select().from(warbandStash).where(inArray(warbandStash.warbandId, ids)).all() : [];
	const models = db.select().from(model).where(eq(model.campaignId, campaignId)).all();

	const images: Record<string, string> = {};
	for (const path of [
		...players.map((p) => p.portrait),
		...warbands.map((w) => w.symbol),
		...lore.map((l) => l.image),
		...units.map((u) => u.photo),
		...models.flatMap((m) => [m.token, m.stl])
	]) {
		const full = path ? resolveUpload(path) : null;
		if (!path || !full) continue;
		try {
			images[path] = (await readFile(full)).toString('base64');
		} catch {
			/* missing file: skip */
		}
	}

	return {
		app: 'carcass-front',
		version: BACKUP_VERSION,
		exportedAt: new Date().toISOString(),
		campaign: c,
		players,
		warbands,
		games: db.select().from(game).where(eq(game.campaignId, campaignId)).all(),
		adjustments: db.select().from(adjustment).where(eq(adjustment.campaignId, campaignId)).all(),
		regions: db.select().from(regionWeather).where(eq(regionWeather.campaignId, campaignId)).all(),
		fx: db.select().from(fxState).where(eq(fxState.campaignId, campaignId)).all(),
		lore,
		units,
		stash,
		models,
		images
	};
}

const DATE_FIELDS = ['createdAt', 'committedAt', 'updatedAt'];

/** JSON turned Dates into strings; turn them back. */
function revive<T extends Row>(row: Row): T {
	const out: Row = { ...row };
	for (const k of DATE_FIELDS) if (typeof out[k] === 'string' || typeof out[k] === 'number') out[k] = new Date(out[k] as string);
	return out as T;
}

/**
 * Replace the campaign(s) in this database with a backup. Runs in one transaction,
 * so a bad file leaves the current campaign untouched.
 */
export async function importCampaign(raw: unknown) {
	const b = raw as Backup;
	if (!b || b.app !== 'carcass-front' || typeof b.version !== 'number' || !b.campaign?.id)
		throw new Error('Not a Carcass Front backup');
	if (b.version > BACKUP_VERSION) throw new Error('This backup is from a newer version of the app');

	db.transaction((tx) => {
		tx.delete(model).run();
		tx.delete(zoneLore).run();
		tx.delete(warbandStash).run();
		tx.delete(unit).run();
		tx.delete(adjustment).run();
		tx.delete(game).run();
		tx.delete(regionWeather).run();
		tx.delete(fxState).run();
		tx.delete(warband).run();
		tx.delete(player).run();
		tx.delete(campaign).run();

		tx.insert(campaign).values(revive<typeof campaign.$inferInsert>(b.campaign)).run();
		for (const r of b.players ?? []) tx.insert(player).values(revive<typeof player.$inferInsert>(r)).run();
		for (const r of b.warbands ?? []) tx.insert(warband).values(revive<typeof warband.$inferInsert>(r)).run();
		for (const r of b.games ?? []) tx.insert(game).values(revive<typeof game.$inferInsert>(r)).run();
		for (const r of b.adjustments ?? []) tx.insert(adjustment).values(revive<typeof adjustment.$inferInsert>(r)).run();
		for (const r of b.regions ?? []) tx.insert(regionWeather).values(revive<typeof regionWeather.$inferInsert>(r)).run();
		for (const r of b.fx ?? []) tx.insert(fxState).values(revive<typeof fxState.$inferInsert>(r)).run();
		for (const r of b.lore ?? []) tx.insert(zoneLore).values(revive<typeof zoneLore.$inferInsert>(r)).run();
		for (const r of b.units ?? []) tx.insert(unit).values(revive<typeof unit.$inferInsert>(r)).run();
		for (const r of b.stash ?? []) tx.insert(warbandStash).values(revive<typeof warbandStash.$inferInsert>(r)).run();
		for (const r of b.models ?? []) tx.insert(model).values(revive<typeof model.$inferInsert>(r)).run();
	});

	for (const [path, data] of Object.entries(b.images ?? {})) {
		const full = resolveUpload(path);
		if (!full || !/\.(webp|stl)$/.test(full)) continue;
		await mkdir(dirname(full), { recursive: true });
		await writeFile(full, Buffer.from(data, 'base64'));
	}
	return b.campaign.id as string;
}
