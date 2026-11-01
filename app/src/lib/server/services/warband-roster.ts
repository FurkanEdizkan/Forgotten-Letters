/**
 * A warband's roster: recruit fighters, buy kit, and upgrades; editing, copying and removing a fighter are in
 * `warband-fighters.ts` (re-exported here). Kit leaving or moving is in `warband-items.ts`; the Arsenal, fireteams and locations in `warband-stash.ts`,
 * fighter images in `fighter-images.ts`. Every change locks the warband, runs the engine's check for it
 * (or `canChange` when it has none) and is refused with the engine's reasons unless the warband's campaign allows
 * going beyond limits. Buying takes the worth it adds from the banks; selling gives back what it took away, so a
 * discounted or free first copy refunds what it cost.
 */
import {
	availableLines,
	availableUnits,
	buildModels,
	capOf,
	canEquip,
	canRecruitWith,
	canUpgrade,
	isActive,
	limitCount,
	loadoutOptions,
	priceOf,
	unitKey,
	upgradeFor
} from '#lib/warbands';
import type { ApiArmouryLine, ApiRecruit, ApiUpgrade } from '#lib/schemas/warbands';
import { AppError } from '../errors';
import { db } from '../db';
import * as repo from '../repos/warbands';
import type { Ctx } from './audit';
import { allowChange, change, decide, fighterOf, load, payFor, type Loaded } from './warband-state';

export { copyFighter, editFighter, removeFighter } from './warband-fighters';

// ---------------------------------------------------------------- fighters

/**
 * Every entry for the Add fighter dialog, with whether it may be recruited now and why not, and the upgrades and
 * loadouts it may take with it.
 */
export async function recruits(ctx: Ctx, id: string): Promise<ApiRecruit[]> {
	const l = await load(db(), ctx, id);
	const on = l.state.fighters.filter(isActive);
	return availableUnits(l.state, l.f, l.opts).map((u) => {
		const p = priceOf(l.state, l.f, { unitId: u.unit.id }, l.opts);
		const key = unitKey(l.f, u.unit);
		return {
			unitId: u.unit.id,
			name: u.unit.name,
			category: u.unit.category,
			taken: on.filter((x) => {
				const unit = l.f.idx.units.get(x.unitId);
				return !!unit && unitKey(l.f, unit) === key;
			}).length,
			max: capOf(l.f, u.unit),
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

// ---------------------------------------------------------------- kit and upgrades

/** The lines a fighter may look at in the Equip dialog, with prices and whether it may take each now. */
export async function armoury(ctx: Ctx, id: string, fid: string): Promise<ApiArmouryLine[]> {
	const l = await load(db(), ctx, id);
	fighterOf(l, fid);
	const models = buildModels(l.state, l.f);
	const lctx = { f: l.f, state: l.state, opts: l.opts };
	return availableLines(l.state, l.f, fid, l.opts).map((x) => {
		const p = priceOf(l.state, l.f, { lineId: x.line.id, fighterId: fid }, l.opts);
		const item = l.f.idx.items.get(x.line.item);
		return {
			...(x.line.limit != null
				? { used: limitCount(x.line, models, l.state, lctx), limit: x.line.limit }
				: {}),
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
				text: u.text ?? null,
				taken: l.state.fighters.filter((y) => isActive(y) && y.upgrades.includes(u.id)).length,
				max: u.max ?? null,
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
