/**
 * A warband's roster: recruit, edit and remove fighters (groups, Dead included), buy and sell kit, and upgrades.
 * The stash, fireteams and locations are in `warband-stash.ts`, fighter images in `fighter-images.ts`. Every change locks the warband, runs the engine's check for it
 * (or `canChange` when it has none) and is refused with the engine's reasons unless the warband's campaign allows
 * going beyond limits. Buying takes the worth it adds from the banks; selling gives back what it took away, so a
 * discounted or free first copy refunds what it cost.
 */
import {
	availableLines,
	availableUnits,
	canEquip,
	canRecruitWith,
	canUpgrade,
	loadoutOptions,
	priceOf,
	skillRef,
	upgradeFor,
	type WarbandState
} from '#lib/warbands';
import type {
	ApiArmouryLine,
	ApiRecruit,
	ApiUpgrade,
	ApiWarband,
	FighterPatch
} from '#lib/schemas/warbands';
import { AppError } from '../errors';
import { db, type Tx } from '../db';
import * as repo from '../repos/warbands';
import type { Ctx } from './audit';
import * as images from './fighter-images';
import {
	allowChange,
	banksAfter,
	change,
	decide,
	fighterOf,
	load,
	stale,
	type Loaded
} from './warband-state';

/** Save the banks after a fighter change (and bump the warband's version). */
const payFor = (tx: Tx, l: Loaded, after: WarbandState, extra: repo.WarbandFields = {}) =>
	repo.update(tx, l.w.id, { ...banksAfter(l, after), ...extra });

// ---------------------------------------------------------------- fighters

/**
 * Every entry for the Add fighter dialog, with whether it may be recruited now and why not, and the upgrades and
 * loadouts it may take with it.
 */
export async function recruits(ctx: Ctx, id: string): Promise<ApiRecruit[]> {
	const l = await load(db(), ctx, id);
	return availableUnits(l.state, l.f, l.opts).map((u) => {
		const p = priceOf(l.state, l.f, { unitId: u.unit.id }, l.opts);
		return {
			unitId: u.unit.id,
			name: u.unit.name,
			category: u.unit.category,
			cost: p.cost,
			currency: p.currency,
			ok: u.ok,
			reasons: u.ok ? [] : u.reasons,
			upgrades: l.f.upgrades
				.filter((up) => upgradeFor(l.f, up, u.unit))
				.map((up) => ({ upgradeId: up.id, name: up.name, cost: up.cost, currency: up.currency })),
			loadouts: loadoutOptions(l.f, u.unit.id)
		};
	});
}

/**
 * Recruit an entry, paid from the banks, with the upgrades and loadout picked for it, all checked as one purchase;
 * it joins its own group (Elites, Troops or Mercenaries).
 */
export function recruit(
	ctx: Ctx,
	id: string,
	input: { unitId: string; name?: string; upgrades?: string[]; kit?: string[] }
) {
	return change(ctx, id, async (tx, l) => {
		const pick = { upgrades: input.upgrades ?? [], kit: input.kit ?? [] };
		decide(l, canRecruitWith(l.state, l.f, input.unitId, pick, l.opts));
		const unit = l.f.idx.units.get(input.unitId)!;
		const [made] = await repo.insertFighters(tx, [
			{
				warbandId: l.w.id,
				unitId: unit.id,
				name: input.name || null,
				grp: unit.category,
				upgrades: pick.upgrades,
				kit: pick.kit,
				sort: await repo.nextSort(tx, l.w.id)
			}
		]);
		const after = {
			...l.state,
			fighters: [
				...l.state.fighters,
				{
					id: made!.id,
					unitId: unit.id,
					group: unit.category,
					kit: pick.kit,
					upgrades: pick.upgrades,
					skills: [],
					injuries: [],
					xp: 0
				}
			]
		};
		await payFor(tx, l, after);
	});
}

/** A skill or injury as given: an id kept, a name matched to the rules, anything else kept as text. */
const refOf = (l: Loaded, s: string) => (/^(skill|table):/.test(s) ? s : (skillRef(l.f, s) ?? s));

/**
 * Edit a fighter: name, group (Dead included: it leaves its fireteam), Experience, skills and injuries; with its
 * version.
 */
export function editFighter(ctx: Ctx, id: string, fid: string, input: FighterPatch) {
	return change(ctx, id, async (tx, l) => {
		const x = fighterOf(l, fid);
		const fields: repo.FighterFields = {
			...(input.name !== undefined ? { name: input.name || null } : {}),
			...(input.group !== undefined ? { grp: input.group } : {}),
			...(input.xp !== undefined ? { xp: input.xp } : {}),
			...(input.skills ? { skills: input.skills.map((s) => refOf(l, s)) } : {}),
			...(input.injuries ? { injuries: input.injuries.map((s) => refOf(l, s)) } : {})
		};
		const y = {
			...x,
			...(fields.name !== undefined ? { name: fields.name ?? undefined } : {}),
			...(fields.grp ? { group: fields.grp } : {}),
			...(fields.xp !== undefined ? { xp: fields.xp } : {}),
			...(fields.skills ? { skills: fields.skills } : {}),
			...(fields.injuries ? { injuries: fields.injuries } : {})
		};
		// A fighter moved to Dead leaves its fireteam, as one removed does.
		const fireteams =
			y.group === 'dead' ? l.state.fireteams.filter((t) => !t.includes(fid)) : l.state.fireteams;
		const after = {
			...l.state,
			fighters: l.state.fighters.map((f) => (f.id === fid ? y : f)),
			fireteams
		};
		allowChange(l, after);
		if (!(await repo.updateFighter(tx, fid, fields, input.version))) throw stale();
		// Moving to Dead or back changes the worth on the table, not the banks (a fallen fighter is no refund).
		await repo.update(tx, l.w.id, fireteams === l.state.fireteams ? {} : { fireteams });
	});
}

/** Remove a fighter: what it was worth goes back to the banks, it leaves its fireteam, its image goes. */
export async function removeFighter(ctx: Ctx, id: string, fid: string): Promise<ApiWarband> {
	let hadImage = false;
	const out = await change(ctx, id, async (tx, l) => {
		fighterOf(l, fid);
		hadImage = !!l.rows.find((r) => r.id === fid)?.image;
		const fireteams = l.state.fireteams.filter((t) => !t.includes(fid));
		const after = { ...l.state, fighters: l.state.fighters.filter((x) => x.id !== fid), fireteams };
		allowChange(l, after);
		await repo.removeFighter(tx, fid);
		await payFor(tx, l, after, { fireteams });
	});
	if (hadImage) await images.removeFile(id, fid);
	return out;
}

// ---------------------------------------------------------------- kit and upgrades

/** The lines a fighter may look at in the Equip dialog, with prices and whether it may take each now. */
export async function armoury(ctx: Ctx, id: string, fid: string): Promise<ApiArmouryLine[]> {
	const l = await load(db(), ctx, id);
	fighterOf(l, fid);
	return availableLines(l.state, l.f, fid, l.opts).map((x) => {
		const p = priceOf(l.state, l.f, { lineId: x.line.id, fighterId: fid }, l.opts);
		const item = l.f.idx.items.get(x.line.item);
		return {
			lineId: x.line.id,
			itemId: x.line.item,
			name: item?.name ?? x.line.item,
			category: item?.category ?? 'equipment',
			price: p.cost,
			currency: p.currency,
			ok: x.ok,
			reasons: x.ok ? [] : x.reasons
		};
	});
}

const withKit = (l: Loaded, fid: string, kit: string[]) => ({
	...l.state,
	fighters: l.state.fighters.map((x) => (x.id === fid ? { ...x, kit } : x))
});

/** Buy kit for a fighter from one armoury line, paid from the banks. */
export function buy(ctx: Ctx, id: string, fid: string, lineId: string) {
	return change(ctx, id, async (tx, l) => {
		const x = fighterOf(l, fid);
		decide(l, canEquip(l.state, l.f, fid, lineId, l.opts));
		const after = withKit(l, fid, [...x.kit, lineId]);
		await repo.updateFighter(tx, fid, { kit: after.fighters.find((y) => y.id === fid)!.kit });
		await payFor(tx, l, after);
	});
}

/** Sell one piece of a fighter's bought kit (fixed kit is not sold); its worth goes back to the banks. */
export function sell(ctx: Ctx, id: string, fid: string, lineId: string) {
	return change(ctx, id, async (tx, l) => {
		const x = fighterOf(l, fid);
		const at = x.kit.lastIndexOf(lineId);
		if (at < 0) throw new AppError('not_found', 'That fighter does not carry that kit.');
		const kit = x.kit.filter((_, i) => i !== at);
		const after = withKit(l, fid, kit);
		allowChange(l, after);
		await repo.updateFighter(tx, fid, { kit });
		await payFor(tx, l, after);
	});
}

/** The upgrades a fighter's entry may take, with price, whether it has it, and whether it may take it now. */
export async function upgradesFor(ctx: Ctx, id: string, fid: string): Promise<ApiUpgrade[]> {
	const l = await load(db(), ctx, id);
	const x = fighterOf(l, fid);
	const unit = l.f.idx.units.get(x.unitId);
	if (!unit) return [];
	return l.f.upgrades
		.filter((u) => upgradeFor(l.f, u, unit))
		.map((u) => {
			const c = canUpgrade(l.state, l.f, fid, u.id, l.opts);
			return {
				upgradeId: u.id,
				name: u.name,
				cost: u.cost,
				currency: u.currency,
				has: x.upgrades.includes(u.id),
				ok: c.ok,
				reasons: c.ok ? [] : c.reasons
			};
		});
}

const withUpgrades = (l: Loaded, fid: string, upgrades: string[]) => ({
	...l.state,
	fighters: l.state.fighters.map((x) => (x.id === fid ? { ...x, upgrades } : x))
});

/** Give a fighter an upgrade, paid from the banks (once play has begun only upgrades that allow it, Q37). */
export function upgrade(ctx: Ctx, id: string, fid: string, upgradeId: string) {
	return change(ctx, id, async (tx, l) => {
		const x = fighterOf(l, fid);
		decide(l, canUpgrade(l.state, l.f, fid, upgradeId, l.opts));
		const upgrades = [...x.upgrades, upgradeId];
		await repo.updateFighter(tx, fid, { upgrades });
		await payFor(tx, l, withUpgrades(l, fid, upgrades));
	});
}

/** Take an upgrade off a fighter; its worth goes back to the banks. */
export function removeUpgrade(ctx: Ctx, id: string, fid: string, upgradeId: string) {
	return change(ctx, id, async (tx, l) => {
		const x = fighterOf(l, fid);
		if (!x.upgrades.includes(upgradeId))
			throw new AppError('not_found', 'That fighter does not have that upgrade.');
		const upgrades = x.upgrades.filter((u) => u !== upgradeId);
		const after = withUpgrades(l, fid, upgrades);
		allowChange(l, after);
		await repo.updateFighter(tx, fid, { upgrades });
		await payFor(tx, l, after);
	});
}
