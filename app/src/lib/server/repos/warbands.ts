/**
 * Warbands and their fighters (warband.warbands, warband.fighters), and the seat a warband sits in
 * (campaign.seats.warband_id). The only SQL for them. Every change bumps the warband's version, so its ETag moves.
 */
import { and, asc, eq, inArray, max, sql } from 'drizzle-orm';
import type { Tx } from '../db';
import {
	campaigns,
	fighters,
	seats,
	users,
	warbands,
	type FighterRow,
	type WarbandRow
} from '../db/schema';

export type { FighterRow, WarbandRow };
export type WarbandFields = Partial<
	Pick<
		WarbandRow,
		| 'name'
		| 'rulesSet'
		| 'rulesExpansions'
		| 'patronId'
		| 'dedication'
		| 'ducatLimit'
		| 'stashDucats'
		| 'unspentGlory'
		| 'stash'
		| 'fireteams'
		| 'locations'
		| 'notes'
		| 'gamesPlayed'
		| 'victoryPoints'
		| 'failedPromotions'
		| 'ignoreLimits'
	>
>;
export type FighterFields = Partial<
	Pick<
		FighterRow,
		| 'name'
		| 'grp'
		| 'kit'
		| 'upgrades'
		| 'skills'
		| 'injuries'
		| 'xp'
		| 'status'
		| 'battleScars'
		| 'image'
	>
>;

export async function insert(tx: Tx, row: typeof warbands.$inferInsert) {
	const [w] = await tx.insert(warbands).values(row).returning();
	return w!;
}

export const findById = async (tx: Tx, id: string) =>
	(await tx.select().from(warbands).where(eq(warbands.id, id)))[0] ?? null;

/** The row, locked until the transaction ends: changes to one warband run one after the other. */
export async function lock(tx: Tx, id: string) {
	const [w] = await tx.select().from(warbands).where(eq(warbands.id, id)).for('update');
	return w ?? null;
}

export const listByOwner = (tx: Tx, ownerId: string) =>
	tx
		.select()
		.from(warbands)
		.where(eq(warbands.ownerId, ownerId))
		.orderBy(asc(sql`lower(${warbands.name})`), asc(warbands.id));

export const ownerName = async (tx: Tx, userId: string) =>
	(await tx.select({ n: users.displayName }).from(users).where(eq(users.id, userId)))[0]?.n ??
	'Former member';

/** Change fields and bump the version; with `version`, only if nobody changed it since (else null). */
export async function update(tx: Tx, id: string, fields: WarbandFields, version?: number) {
	const [w] = await tx
		.update(warbands)
		.set({ ...fields, version: sql`${warbands.version} + 1` })
		.where(
			version === undefined
				? eq(warbands.id, id)
				: and(eq(warbands.id, id), eq(warbands.version, version))
		)
		.returning();
	return w ?? null;
}

/** Delete warbands (fighters cascade; their seats let go); returns the deleted ids. */
export const remove = (tx: Tx, ids: string[]) =>
	ids.length
		? tx.delete(warbands).where(inArray(warbands.id, ids)).returning({ id: warbands.id })
		: Promise.resolve([]);

// ---------------------------------------------------------------- fighters

/** Fighters of these warbands in roster order (prices depend on it). */
export const fightersOf = (tx: Tx, warbandIds: string[]) =>
	warbandIds.length
		? tx
				.select()
				.from(fighters)
				.where(inArray(fighters.warbandId, warbandIds))
				.orderBy(asc(fighters.sort), asc(fighters.id))
		: Promise.resolve([] as FighterRow[]);

export const findFighter = async (tx: Tx, warbandId: string, id: string) =>
	(
		await tx
			.select()
			.from(fighters)
			.where(and(eq(fighters.id, id), eq(fighters.warbandId, warbandId)))
	)[0] ?? null;

export const fighterById = async (tx: Tx, id: string) =>
	(await tx.select().from(fighters).where(eq(fighters.id, id)))[0] ?? null;

export async function nextSort(tx: Tx, warbandId: string) {
	const [r] = await tx
		.select({ n: max(fighters.sort) })
		.from(fighters)
		.where(eq(fighters.warbandId, warbandId));
	return (r?.n ?? 0) + 1;
}

export const insertFighters = (tx: Tx, rows: (typeof fighters.$inferInsert)[]) =>
	rows.length ? tx.insert(fighters).values(rows).returning() : Promise.resolve([]);

/** Change a fighter; with `version`, only if nobody changed it since (else null). */
export async function updateFighter(tx: Tx, id: string, fields: FighterFields, version?: number) {
	const [f] = await tx
		.update(fighters)
		.set({ ...fields, version: sql`${fighters.version} + 1` })
		.where(
			version === undefined
				? eq(fighters.id, id)
				: and(eq(fighters.id, id), eq(fighters.version, version))
		)
		.returning();
	return f ?? null;
}

export const removeFighter = (tx: Tx, id: string) => tx.delete(fighters).where(eq(fighters.id, id));

/** Every fighter id with an image among these warbands (their files go when the warbands do). */
export const imagesOf = (tx: Tx, warbandIds: string[]) =>
	warbandIds.length
		? tx
				.select({ id: fighters.id, warbandId: fighters.warbandId })
				.from(fighters)
				.where(and(inArray(fighters.warbandId, warbandIds), sql`${fighters.image} is not null`))
		: Promise.resolve([]);

// ---------------------------------------------------------------- seats

/** The seat (and its campaign) each of these warbands sits in, if any. */
export const seatsOf = (tx: Tx, warbandIds: string[]) =>
	warbandIds.length
		? tx
				.select({
					warbandId: seats.warbandId,
					seatId: seats.id,
					seatName: seats.name,
					campaignId: campaigns.id,
					campaignName: campaigns.name,
					stage: campaigns.stage,
					allowBeyondLimits: campaigns.allowBeyondLimits,
					rulesSet: campaigns.rulesSet,
					rulesExpansions: campaigns.rulesExpansions,
					deletedAt: campaigns.deletedAt
				})
				.from(seats)
				.innerJoin(campaigns, eq(campaigns.id, seats.campaignId))
				.where(inArray(seats.warbandId, warbandIds))
		: Promise.resolve([]);
export type SeatOf = Awaited<ReturnType<typeof seatsOf>>[number];

/** The warbands sitting in a campaign's seats, by seat. */
export const ofCampaign = (tx: Tx, campaignId: string) =>
	tx
		.select({ seatId: seats.id, seatName: seats.name, warbandId: seats.warbandId })
		.from(seats)
		.where(and(eq(seats.campaignId, campaignId), sql`${seats.warbandId} is not null`))
		.orderBy(asc(seats.number));

/** The warbands sitting in a campaign, with the rules each is built for. */
export const rulesInCampaign = (tx: Tx, campaignId: string) =>
	tx
		.select({
			name: warbands.name,
			rulesSet: warbands.rulesSet,
			rulesExpansions: warbands.rulesExpansions
		})
		.from(seats)
		.innerJoin(warbands, eq(warbands.id, seats.warbandId))
		.where(eq(seats.campaignId, campaignId))
		.orderBy(asc(seats.number));

/** Put a warband in a seat (or take it out with null); bumps the seat's version. */
export const setSeat = (tx: Tx, seatId: string, warbandId: string | null) =>
	tx
		.update(seats)
		.set({ warbandId, version: sql`${seats.version} + 1` })
		.where(eq(seats.id, seatId));

/** Warbands owned by someone, for removing them with the account. */
export const idsOfOwner = async (tx: Tx, ownerId: string) =>
	(await tx.select({ id: warbands.id }).from(warbands).where(eq(warbands.ownerId, ownerId))).map(
		(r) => r.id
	);
