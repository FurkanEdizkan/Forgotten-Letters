import { eq } from 'drizzle-orm';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { db } from './db';
import { adjustment, campaign, fxState, game, player, regionWeather, warband } from './db/schema';
import { resolveUpload } from './uploads';

export const BACKUP_VERSION = 1;

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
	/** Uploaded images, base64, keyed by their /uploads path. */
	images: Record<string, string>;
}

/** Everything for one campaign, images included, as a single JSON document. */
export async function exportCampaign(campaignId: string): Promise<Backup> {
	const c = db.select().from(campaign).where(eq(campaign.id, campaignId)).get();
	if (!c) throw new Error('No campaign');
	const players = db.select().from(player).where(eq(player.campaignId, campaignId)).all();
	const warbands = db.select().from(warband).where(eq(warband.campaignId, campaignId)).all();

	const images: Record<string, string> = {};
	for (const path of [...players.map((p) => p.portrait), ...warbands.map((w) => w.symbol)]) {
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
	});

	for (const [path, data] of Object.entries(b.images ?? {})) {
		const full = resolveUpload(path);
		if (!full || !full.endsWith('.webp')) continue;
		await mkdir(dirname(full), { recursive: true });
		await writeFile(full, Buffer.from(data, 'base64'));
	}
	return b.campaign.id as string;
}
