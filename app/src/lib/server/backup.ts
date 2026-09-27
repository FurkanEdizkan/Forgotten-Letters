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
	unitArt,
	user,
	regionWeather,
	unit,
	warband,
	warbandStash,
	zoneLore
} from './db/schema';
import { resolveUpload } from './uploads';

/** v2 added lore, rosters and models (and their files); v3 adds accounts. Older backups still import. */
export const BACKUP_VERSION = 3;

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
	unitArt?: Row[];
	/** Accounts, with their password hashes (v3). */
	users?: Row[];
	/** Uploaded files (images and model STLs), base64, keyed by their /uploads path. */
	images: Record<string, string>;
}

/** Everything for one campaign, images included, as a single JSON document. */
export async function exportCampaign(campaignId: string): Promise<Backup> {
	const c = (await db.select().from(campaign).where(eq(campaign.id, campaignId)))[0];
	if (!c) throw new Error('No campaign');
	const players = (await db.select().from(player).where(eq(player.campaignId, campaignId)));
	const warbands = (await db.select().from(warband).where(eq(warband.campaignId, campaignId)));

	const ids = warbands.map((w) => w.id);
	const lore = (await db.select().from(zoneLore).where(eq(zoneLore.campaignId, campaignId)));
	const units = ids.length ? (await db.select().from(unit).where(inArray(unit.warbandId, ids))) : [];
	const stash = ids.length ? (await db.select().from(warbandStash).where(inArray(warbandStash.warbandId, ids))) : [];
	const models = (await db.select().from(model).where(eq(model.campaignId, campaignId)));
	const art = await db.select().from(unitArt).where(eq(unitArt.campaignId, campaignId));

	const images: Record<string, string> = {};
	for (const path of [
		...players.map((p) => p.portrait),
		...warbands.map((w) => w.symbol),
		...warbands.flatMap((w) => [w.seal?.custom?.base, w.seal?.custom?.light, w.seal?.custom?.source]),
		...lore.map((l) => l.image),
		...units.map((u) => u.photo),
		...models.flatMap((m) => [m.token, m.stl]),
		...art.map((a) => a.image)
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
		games: (await db.select().from(game).where(eq(game.campaignId, campaignId))),
		adjustments: (await db.select().from(adjustment).where(eq(adjustment.campaignId, campaignId))),
		regions: (await db.select().from(regionWeather).where(eq(regionWeather.campaignId, campaignId))),
		fx: (await db.select().from(fxState).where(eq(fxState.campaignId, campaignId))),
		lore,
		units,
		stash,
		models,
		unitArt: art,
		users: await db.select().from(user),
		images
	};
}

const DATE_FIELDS = ['createdAt', 'committedAt', 'updatedAt', 'lastSignInAt'];

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

	await db.transaction(async (tx) => {
		await tx.delete(unitArt);
		(await tx.delete(model));
		(await tx.delete(zoneLore));
		(await tx.delete(warbandStash));
		(await tx.delete(unit));
		(await tx.delete(adjustment));
		(await tx.delete(game));
		(await tx.delete(regionWeather));
		(await tx.delete(fxState));
		(await tx.delete(warband));
		(await tx.delete(player));
		(await tx.delete(campaign));
		// Accounts are replaced only when the backup carries them, so an older backup can't lock the CM out.
		if (b.users?.length) await tx.delete(user);

		for (const r of b.users ?? []) await tx.insert(user).values(revive<typeof user.$inferInsert>(r));
		(await tx.insert(campaign).values(revive<typeof campaign.$inferInsert>(b.campaign)));
		for (const r of b.players ?? []) (await tx.insert(player).values(revive<typeof player.$inferInsert>(r)));
		for (const r of b.warbands ?? []) (await tx.insert(warband).values(revive<typeof warband.$inferInsert>(r)));
		for (const r of b.games ?? []) (await tx.insert(game).values(revive<typeof game.$inferInsert>(r)));
		for (const r of b.adjustments ?? []) (await tx.insert(adjustment).values(revive<typeof adjustment.$inferInsert>(r)));
		for (const r of b.regions ?? []) (await tx.insert(regionWeather).values(revive<typeof regionWeather.$inferInsert>(r)));
		for (const r of b.fx ?? []) (await tx.insert(fxState).values(revive<typeof fxState.$inferInsert>(r)));
		for (const r of b.lore ?? []) (await tx.insert(zoneLore).values(revive<typeof zoneLore.$inferInsert>(r)));
		for (const r of b.units ?? []) (await tx.insert(unit).values(revive<typeof unit.$inferInsert>(r)));
		for (const r of b.stash ?? []) (await tx.insert(warbandStash).values(revive<typeof warbandStash.$inferInsert>(r)));
		for (const r of b.models ?? []) (await tx.insert(model).values(revive<typeof model.$inferInsert>(r)));
		for (const r of b.unitArt ?? []) await tx.insert(unitArt).values(revive<typeof unitArt.$inferInsert>(r));
	});

	for (const [path, data] of Object.entries(b.images ?? {})) {
		const full = resolveUpload(path);
		if (!full || !/\.(webp|stl)$/.test(full)) continue;
		await mkdir(dirname(full), { recursive: true });
		await writeFile(full, Buffer.from(data, 'base64'));
	}
	return b.campaign.id as string;
}
