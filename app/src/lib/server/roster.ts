import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from './db';
import { unit, warband, warbandStash } from './db/schema';
import { sellValue, type Item, type RosterUnit } from '$lib/roster';

export type Unit = typeof unit.$inferSelect;
export type StashItem = typeof warbandStash.$inferSelect;

export async function roster(warbandId: string) {
	const units = (await db.select().from(unit).where(eq(unit.warbandId, warbandId)).orderBy(asc(unit.sort), asc(unit.createdAt)));
	const stash = (await db.select().from(warbandStash).where(eq(warbandStash.warbandId, warbandId)));
	return { units, stash };
}

/** All active units per warband, for the public snapshot. */
export async function activeUnitsByWarband(campaignId: string) {
	const map = new Map<string, Unit[]>();
	for (const u of (await db
		.select()
		.from(unit)
		.where(and(eq(unit.campaignId, campaignId), eq(unit.status, 'active')))
		.orderBy(asc(unit.sort), asc(unit.createdAt))
		)) {
		map.set(u.warbandId, [...(map.get(u.warbandId) ?? []), u]);
	}
	return map;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function charge(tx: Tx, warbandId: string, cost: number, currency: 'ducats' | 'glory', sign: 1 | -1) {
	const col = currency === 'glory' ? warband.treasuryGlory : warband.treasuryDucats;
	const key = currency === 'glory' ? 'treasuryGlory' : 'treasuryDucats';
	(await tx.update(warband)
		.set({ [key]: sql`${col} + ${sign * cost}` })
		.where(eq(warband.id, warbandId))
		);
}

export async function setBank(warbandId: string, ducats: number, glory: number) {
	(await db.update(warband).set({ treasuryDucats: ducats, treasuryGlory: glory }).where(eq(warband.id, warbandId)));
}

export async function addUnit(campaignId: string | null, warbandId: string, u: RosterUnit, pay: boolean) {
	await db.transaction(async (tx) => {
		const max = (await tx
			.select({ m: sql<number>`coalesce(max(${unit.sort}), 0)` })
			.from(unit)
			.where(eq(unit.warbandId, warbandId))
			)[0];
		(await tx.insert(unit)
			.values({ ...u, campaignId, warbandId, sort: (max?.m ?? 0) + 1 })
			);
		if (pay) await charge(tx, warbandId, u.cost, u.currency, -1);
	});
}

export async function saveUnit(warbandId: string, unitId: string, fields: Partial<RosterUnit> & { photo?: string | null }) {
	(await db.update(unit)
		.set(fields)
		.where(and(eq(unit.id, unitId), eq(unit.warbandId, warbandId)))
		);
}

export async function removeUnit(warbandId: string, unitId: string, refund: 'none' | 'sell' | 'refund') {
	await db.transaction(async (tx) => {
		const u = (await tx.select().from(unit).where(and(eq(unit.id, unitId), eq(unit.warbandId, warbandId))))[0];
		if (!u) return;
		if (refund !== 'none') {
			// Equipment carried by the model goes to the stash rather than vanishing.
			for (const e of u.equipment) (await tx.insert(warbandStash).values({ warbandId, ...e }));
			await charge(tx, warbandId, refund === 'sell' ? sellValue(u.cost) : u.cost, u.currency, 1);
		}
		(await tx.delete(unit).where(eq(unit.id, unitId)));
	});
}

export async function moveUnit(warbandId: string, unitId: string, dir: -1 | 1) {
	const { units } = await roster(warbandId);
	const i = units.findIndex((u) => u.id === unitId);
	const j = i + dir;
	if (i < 0 || j < 0 || j >= units.length) return;
	await db.transaction(async (tx) => {
		for (const [k, u] of units.entries()) {
			const pos = k === i ? j : k === j ? i : k;
			await tx.update(unit).set({ sort: pos + 1 }).where(eq(unit.id, u.id));
		}
	});
}

/** Where an item lives: on a model (by index) or in the stash (by id). */
export type ItemRef = { unitId: string; index: number } | { stashId: string };

async function takeItem(tx: Tx, warbandId: string, ref: ItemRef): Promise<Item | null> {
	if ('stashId' in ref) {
		const row = (await tx
			.select()
			.from(warbandStash)
			.where(and(eq(warbandStash.id, ref.stashId), eq(warbandStash.warbandId, warbandId)))
			)[0];
		if (!row) return null;
		(await tx.delete(warbandStash).where(eq(warbandStash.id, row.id)));
		return { name: row.name, kind: row.kind, cost: row.cost, currency: row.currency };
	}
	const u = (await tx.select().from(unit).where(and(eq(unit.id, ref.unitId), eq(unit.warbandId, warbandId))))[0];
	const item = u?.equipment[ref.index];
	if (!u || !item) return null;
	(await tx.update(unit)
		.set({ equipment: u.equipment.filter((_, k) => k !== ref.index) })
		.where(eq(unit.id, u.id))
		);
	return item;
}

async function putItem(tx: Tx, warbandId: string, target: string, item: Item) {
	if (target === 'stash') {
		(await tx.insert(warbandStash).values({ warbandId, ...item }));
		return;
	}
	const u = (await tx.select().from(unit).where(and(eq(unit.id, target), eq(unit.warbandId, warbandId))))[0];
	if (!u) throw new Error('No such model');
	(await tx.update(unit).set({ equipment: [...u.equipment, item] }).where(eq(unit.id, u.id)));
}

/** Buy a new item for a model or the stash, paying from the bank. */
export async function buyItem(warbandId: string, target: string, item: Item) {
	await db.transaction(async (tx) => {
		await putItem(tx, warbandId, target, item);
		await charge(tx, warbandId, item.cost, item.currency, -1);
	});
}

/** Move / sell (half back) / refund (full) / delete (nothing back) / copy (buy another). */
export async function itemOp(warbandId: string, ref: ItemRef, op: 'move' | 'sell' | 'refund' | 'delete' | 'copy', target = 'stash') {
	await db.transaction(async (tx) => {
		if (op === 'copy') {
			const item = await takeItem(tx, warbandId, ref);
			if (!item) return;
			const home = 'stashId' in ref ? 'stash' : ref.unitId;
			await putItem(tx, warbandId, home, item);
			await putItem(tx, warbandId, home, item);
			await charge(tx, warbandId, item.cost, item.currency, -1);
			return;
		}
		const item = await takeItem(tx, warbandId, ref);
		if (!item) return;
		if (op === 'move') await putItem(tx, warbandId, target, item);
		if (op === 'sell') await charge(tx, warbandId, sellValue(item.cost), item.currency, 1);
		if (op === 'refund') await charge(tx, warbandId, item.cost, item.currency, 1);
	});
}

/** Replace a warband's roster and banks with an imported list. */
export async function replaceRoster(campaignId: string | null, warbandId: string, data: { units: RosterUnit[]; stash: Item[]; ducats: number; glory: number }) {
	await db.transaction(async (tx) => {
		(await tx.delete(unit).where(eq(unit.warbandId, warbandId)));
		(await tx.delete(warbandStash).where(eq(warbandStash.warbandId, warbandId)));
		for (const [i, u] of data.units.entries()) await tx.insert(unit).values({ ...u, campaignId, warbandId, sort: i + 1 });
		for (const s of data.stash) (await tx.insert(warbandStash).values({ warbandId, ...s }));
		(await tx.update(warband)
			.set({ treasuryDucats: data.ducats, treasuryGlory: data.glory })
			.where(eq(warband.id, warbandId))
			);
	});
}
