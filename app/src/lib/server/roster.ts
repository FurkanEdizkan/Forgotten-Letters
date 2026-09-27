import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from './db';
import { unit, warband, warbandStash } from './db/schema';
import { sellValue, type Item, type RosterUnit } from '$lib/roster';

export type Unit = typeof unit.$inferSelect;
export type StashItem = typeof warbandStash.$inferSelect;

export function roster(warbandId: string) {
	const units = db.select().from(unit).where(eq(unit.warbandId, warbandId)).orderBy(asc(unit.sort), asc(unit.createdAt)).all();
	const stash = db.select().from(warbandStash).where(eq(warbandStash.warbandId, warbandId)).all();
	return { units, stash };
}

/** All active units per warband, for the public snapshot. */
export function activeUnitsByWarband(campaignId: string) {
	const map = new Map<string, Unit[]>();
	for (const u of db
		.select()
		.from(unit)
		.where(and(eq(unit.campaignId, campaignId), eq(unit.status, 'active')))
		.orderBy(asc(unit.sort), asc(unit.createdAt))
		.all()) {
		map.set(u.warbandId, [...(map.get(u.warbandId) ?? []), u]);
	}
	return map;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function charge(tx: Tx, warbandId: string, cost: number, currency: 'ducats' | 'glory', sign: 1 | -1) {
	const col = currency === 'glory' ? warband.treasuryGlory : warband.treasuryDucats;
	const key = currency === 'glory' ? 'treasuryGlory' : 'treasuryDucats';
	tx.update(warband)
		.set({ [key]: sql`${col} + ${sign * cost}` })
		.where(eq(warband.id, warbandId))
		.run();
}

export function setBank(warbandId: string, ducats: number, glory: number) {
	db.update(warband).set({ treasuryDucats: ducats, treasuryGlory: glory }).where(eq(warband.id, warbandId)).run();
}

export function addUnit(campaignId: string, warbandId: string, u: RosterUnit, pay: boolean) {
	db.transaction((tx) => {
		const max = tx
			.select({ m: sql<number>`coalesce(max(${unit.sort}), 0)` })
			.from(unit)
			.where(eq(unit.warbandId, warbandId))
			.get();
		tx.insert(unit)
			.values({ ...u, campaignId, warbandId, sort: (max?.m ?? 0) + 1 })
			.run();
		if (pay) charge(tx, warbandId, u.cost, u.currency, -1);
	});
}

export function saveUnit(warbandId: string, unitId: string, fields: Partial<RosterUnit> & { photo?: string | null }) {
	db.update(unit)
		.set(fields)
		.where(and(eq(unit.id, unitId), eq(unit.warbandId, warbandId)))
		.run();
}

export function removeUnit(warbandId: string, unitId: string, refund: 'none' | 'sell' | 'refund') {
	db.transaction((tx) => {
		const u = tx.select().from(unit).where(and(eq(unit.id, unitId), eq(unit.warbandId, warbandId))).get();
		if (!u) return;
		if (refund !== 'none') {
			// Equipment carried by the model goes to the stash rather than vanishing.
			for (const e of u.equipment) tx.insert(warbandStash).values({ warbandId, ...e }).run();
			charge(tx, warbandId, refund === 'sell' ? sellValue(u.cost) : u.cost, u.currency, 1);
		}
		tx.delete(unit).where(eq(unit.id, unitId)).run();
	});
}

export function moveUnit(warbandId: string, unitId: string, dir: -1 | 1) {
	const { units } = roster(warbandId);
	const i = units.findIndex((u) => u.id === unitId);
	const j = i + dir;
	if (i < 0 || j < 0 || j >= units.length) return;
	db.transaction((tx) => {
		units.forEach((u, k) => {
			const pos = k === i ? j : k === j ? i : k;
			tx.update(unit).set({ sort: pos + 1 }).where(eq(unit.id, u.id)).run();
		});
	});
}

/** Where an item lives: on a model (by index) or in the stash (by id). */
export type ItemRef = { unitId: string; index: number } | { stashId: string };

function takeItem(tx: Tx, warbandId: string, ref: ItemRef): Item | null {
	if ('stashId' in ref) {
		const row = tx
			.select()
			.from(warbandStash)
			.where(and(eq(warbandStash.id, ref.stashId), eq(warbandStash.warbandId, warbandId)))
			.get();
		if (!row) return null;
		tx.delete(warbandStash).where(eq(warbandStash.id, row.id)).run();
		return { name: row.name, kind: row.kind, cost: row.cost, currency: row.currency };
	}
	const u = tx.select().from(unit).where(and(eq(unit.id, ref.unitId), eq(unit.warbandId, warbandId))).get();
	const item = u?.equipment[ref.index];
	if (!u || !item) return null;
	tx.update(unit)
		.set({ equipment: u.equipment.filter((_, k) => k !== ref.index) })
		.where(eq(unit.id, u.id))
		.run();
	return item;
}

function putItem(tx: Tx, warbandId: string, target: string, item: Item) {
	if (target === 'stash') {
		tx.insert(warbandStash).values({ warbandId, ...item }).run();
		return;
	}
	const u = tx.select().from(unit).where(and(eq(unit.id, target), eq(unit.warbandId, warbandId))).get();
	if (!u) throw new Error('No such model');
	tx.update(unit).set({ equipment: [...u.equipment, item] }).where(eq(unit.id, u.id)).run();
}

/** Buy a new item for a model or the stash, paying from the bank. */
export function buyItem(warbandId: string, target: string, item: Item) {
	db.transaction((tx) => {
		putItem(tx, warbandId, target, item);
		charge(tx, warbandId, item.cost, item.currency, -1);
	});
}

/** Move / sell (half back) / refund (full) / delete (nothing back) / copy (buy another). */
export function itemOp(warbandId: string, ref: ItemRef, op: 'move' | 'sell' | 'refund' | 'delete' | 'copy', target = 'stash') {
	db.transaction((tx) => {
		if (op === 'copy') {
			const item = takeItem(tx, warbandId, ref);
			if (!item) return;
			const home = 'stashId' in ref ? 'stash' : ref.unitId;
			putItem(tx, warbandId, home, item);
			putItem(tx, warbandId, home, item);
			charge(tx, warbandId, item.cost, item.currency, -1);
			return;
		}
		const item = takeItem(tx, warbandId, ref);
		if (!item) return;
		if (op === 'move') putItem(tx, warbandId, target, item);
		if (op === 'sell') charge(tx, warbandId, sellValue(item.cost), item.currency, 1);
		if (op === 'refund') charge(tx, warbandId, item.cost, item.currency, 1);
	});
}

/** Replace a warband's roster and banks with an imported list. */
export function replaceRoster(campaignId: string, warbandId: string, data: { units: RosterUnit[]; stash: Item[]; ducats: number; glory: number }) {
	db.transaction((tx) => {
		tx.delete(unit).where(eq(unit.warbandId, warbandId)).run();
		tx.delete(warbandStash).where(eq(warbandStash.warbandId, warbandId)).run();
		data.units.forEach((u, i) => tx.insert(unit).values({ ...u, campaignId, warbandId, sort: i + 1 }).run());
		for (const s of data.stash) tx.insert(warbandStash).values({ warbandId, ...s }).run();
		tx.update(warband)
			.set({ treasuryDucats: data.ducats, treasuryGlory: data.glory })
			.where(eq(warband.id, warbandId))
			.run();
	});
}
