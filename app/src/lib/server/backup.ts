import { and, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { db } from './db';
import {
	mapZone,
	adjustment,
	campaign,
	customFaction,
	rulesFaction,
	rulesItem,
	rulesKeyword,
	rulesUnit,
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
	zoneLore, round, roundEntry, invite } from './db/schema';
import { resolveUpload } from './uploads';

/** v2 added lore, rosters and models (and their files); v3 accounts; v4 players' warband lists; v5 the Faction Studio's work; v6 the map and its zones. Older backups still import. */
export const BACKUP_VERSION = 7;

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
	/** Players' own warband lists (outside the campaign), with their models and stash. */
	lists?: { warbands: Row[]; units: Row[]; stash: Row[] };
	/** Faction Studio: authored factions and every custom or edited rules row (book rows come from rules.json). */
	studio?: { factions: Row[]; units: Row[]; items: Row[]; keywords: Row[]; rules: Row[] };
	/** The map's zones (Map Studio). */
	zones?: Row[];
	/** Rounds of battles, their entries, and the seats' invite links (v7). */
	rounds?: Row[];
	roundEntries?: Row[];
	invites?: Row[];
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
		c.mapImage,
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
		// Rounds of battles (games point at them), their entries, and the seats' invite links.
		rounds: await db.select().from(round).where(eq(round.campaignId, campaignId)),
		roundEntries: await db
			.select({ e: roundEntry })
			.from(roundEntry)
			.innerJoin(round, eq(round.id, roundEntry.roundId))
			.where(eq(round.campaignId, campaignId))
			.then((rows) => rows.map((r) => r.e)),
		invites: await db.select().from(invite).where(eq(invite.campaignId, campaignId)),
		adjustments: (await db.select().from(adjustment).where(eq(adjustment.campaignId, campaignId))),
		regions: (await db.select().from(regionWeather).where(eq(regionWeather.campaignId, campaignId))),
		fx: (await db.select().from(fxState).where(eq(fxState.campaignId, campaignId))),
		lore,
		units,
		stash,
		models,
		unitArt: art,
		zones: await db.select().from(mapZone).where(eq(mapZone.campaignId, campaignId)),
		users: await db.select().from(user),
		lists: await (async () => {
			const warbands = await db.select().from(warband).where(and(isNull(warband.campaignId), isNotNull(warband.listOwnerId)));
			const ids = warbands.map((w) => w.id);
			return {
				warbands,
				units: ids.length ? await db.select().from(unit).where(inArray(unit.warbandId, ids)) : [],
				stash: ids.length ? await db.select().from(warbandStash).where(inArray(warbandStash.warbandId, ids)) : []
			};
		})(),
		studio: {
			factions: await db.select().from(customFaction),
			units: await db.select().from(rulesUnit).where(ne(rulesUnit.origin, 'book')),
			items: await db.select().from(rulesItem).where(ne(rulesItem.origin, 'book')),
			keywords: await db.select().from(rulesKeyword).where(ne(rulesKeyword.origin, 'book')),
			rules: await db.select().from(rulesFaction).where(ne(rulesFaction.origin, 'book'))
		},
		images
	};
}

/**
 * JSON turned Dates into strings; turn them back. Every timestamp column is named `…At` (createdAt, lastSeenAt,
 * closedAt, expiresAt…), so the rule covers tables and columns added later without a list to keep up to date.
 */
export function revive<T extends Row>(row: Row): T {
	const out: Row = { ...row };
	for (const [k, v] of Object.entries(out)) if (k.endsWith('At') && (typeof v === 'string' || typeof v === 'number')) out[k] = new Date(v);
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
		// Campaign rosters go with their warbands (cascade); players' lists stay unless the backup carries them.
		if (b.lists) await tx.delete(warband).where(isNull(warband.campaignId));
		(await tx.delete(adjustment));
		(await tx.delete(game));
		(await tx.delete(regionWeather));
		(await tx.delete(fxState));
		(await tx.delete(warband).where(isNotNull(warband.campaignId)));
		(await tx.delete(player));
		(await tx.delete(campaign));
		// Accounts are replaced only when the backup carries them, so an older backup can't lock the CM out.
		if (b.users?.length) await tx.delete(user);

		for (const r of b.users ?? []) await tx.insert(user).values(revive<typeof user.$inferInsert>(r));
		(await tx.insert(campaign).values(revive<typeof campaign.$inferInsert>(b.campaign)));
		for (const r of b.zones ?? []) await tx.insert(mapZone).values(r as typeof mapZone.$inferInsert);
		for (const r of b.players ?? []) (await tx.insert(player).values(revive<typeof player.$inferInsert>(r)));
		for (const r of b.warbands ?? []) (await tx.insert(warband).values(revive<typeof warband.$inferInsert>(r)));
		for (const r of b.rounds ?? []) await tx.insert(round).values(revive<typeof round.$inferInsert>(r));
		for (const r of b.roundEntries ?? []) await tx.insert(roundEntry).values(revive<typeof roundEntry.$inferInsert>(r));
		for (const r of b.invites ?? []) await tx.insert(invite).values(revive<typeof invite.$inferInsert>(r));
		for (const r of b.games ?? []) (await tx.insert(game).values(revive<typeof game.$inferInsert>(r)));
		for (const r of b.adjustments ?? []) (await tx.insert(adjustment).values(revive<typeof adjustment.$inferInsert>(r)));
		for (const r of b.regions ?? []) (await tx.insert(regionWeather).values(revive<typeof regionWeather.$inferInsert>(r)));
		for (const r of b.fx ?? []) (await tx.insert(fxState).values(revive<typeof fxState.$inferInsert>(r)));
		for (const r of b.lore ?? []) (await tx.insert(zoneLore).values(revive<typeof zoneLore.$inferInsert>(r)));
		for (const r of b.units ?? []) (await tx.insert(unit).values(revive<typeof unit.$inferInsert>(r)));
		for (const r of b.stash ?? []) (await tx.insert(warbandStash).values(revive<typeof warbandStash.$inferInsert>(r)));
		for (const r of b.models ?? []) (await tx.insert(model).values(revive<typeof model.$inferInsert>(r)));
		for (const r of b.unitArt ?? []) await tx.insert(unitArt).values(revive<typeof unitArt.$inferInsert>(r));
		for (const r of b.lists?.warbands ?? []) await tx.insert(warband).values(revive<typeof warband.$inferInsert>(r));
		for (const r of b.lists?.units ?? []) await tx.insert(unit).values(revive<typeof unit.$inferInsert>(r));
		for (const r of b.lists?.stash ?? []) await tx.insert(warbandStash).values(revive<typeof warbandStash.$inferInsert>(r));
		// The Studio's rows replace any same-id rows (an edited book entry overwrites the book's).
		if (b.studio) {
			await tx.delete(customFaction);
			for (const r of b.studio.factions) await tx.insert(customFaction).values(revive<typeof customFaction.$inferInsert>(r));
			const upsert = async (table: typeof rulesUnit | typeof rulesItem | typeof rulesKeyword | typeof rulesFaction, rows: Row[], key: 'id' | 'name') => {
				for (const r of rows) {
					await tx.delete(table).where(eq((table as typeof rulesUnit)[key as 'id'], r[key] as string));
					await tx.insert(table as typeof rulesUnit).values(r as typeof rulesUnit.$inferInsert);
				}
			};
			await upsert(rulesUnit, b.studio.units, 'id');
			await upsert(rulesItem, b.studio.items, 'id');
			await upsert(rulesKeyword, b.studio.keywords, 'name');
			await upsert(rulesFaction, b.studio.rules, 'id');
		}
	});

	for (const [path, data] of Object.entries(b.images ?? {})) {
		const full = resolveUpload(path);
		if (!full || !/\.(webp|stl)$/.test(full)) continue;
		await mkdir(dirname(full), { recursive: true });
		await writeFile(full, Buffer.from(data, 'base64'));
	}
	return b.campaign.id as string;
}
