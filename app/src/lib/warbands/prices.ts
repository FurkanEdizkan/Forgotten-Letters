/**
 * Prices by rule: an entry's or an armoury line's price, then the warband's price rules (the first copy at half
 * price, the second copy on a model in Glory, a Patron Skill's discount while its model is in the warband) and the
 * free first copy of the faction's free items. The rating counts every fighter on the table; Glory-priced things
 * add nothing to the Ducats (Q38).
 *
 * Reused from archive/carcass-front-v1:app/src/lib/warband-rules.ts (priceFor, entryPrice, applyPrice),
 * rewritten to ids and the rules folder format.
 */
import type { ArmouryLine, PriceRule, Unit } from '../rules/pack.ts';
import {
	buildModel,
	buildModels,
	carry,
	fixedPaid,
	itemOf,
	lineFor,
	type Carried,
	type Model
} from './model.ts';
import { isEl, unitKey, type Resolved } from './resolve.ts';
import { matchItem, matchModel, type Ctx } from './select.ts';
import type { Fighter, Options, Price, WarbandState } from './types.ts';

export type Buy = { cost: number; currency: 'ducats' | 'glory' };

function apply(p: Buy, r: PriceRule): Buy {
	if (r.cost != null) return { cost: r.cost, currency: r.currency ?? p.currency };
	if (r.less != null) return { ...p, cost: Math.max(0, p.cost - r.less) };
	return { ...p, cost: Math.ceil(p.cost * (r.factor ?? 1)) };
}

/** The faction's price rules and the Patron's Skills' (those hold while a model with the Skill is in the warband). */
export function priceRules(ctx: Ctx): PriceRule[] {
	const patron = ctx.state.patronId ? ctx.f.idx.patrons.get(ctx.state.patronId) : undefined;
	return [
		...ctx.f.rules.prices,
		...(patron?.skills ?? []).flatMap((s) =>
			(s.prices ?? []).map((r) => (r.who || r.while ? r : { ...r, while: { skills: [s.id] } }))
		)
	];
}

const holds = (r: PriceRule, buyer: Model | undefined, models: Model[], ctx: Ctx) =>
	(!r.who || (!!buyer && matchModel(buyer, r.who, ctx))) &&
	(!r.while || models.some((m) => matchModel(m, r.while, ctx)));

/**
 * What a line's item costs this buyer: `heldBefore` copies of it are already in the warband, `copyBefore` on this
 * model.
 */
export function itemPrice(
	ctx: Ctx,
	models: Model[],
	buyer: Model | undefined,
	line: ArmouryLine,
	heldBefore: number,
	copyBefore: number
): Buy {
	if (heldBefore === 0 && ctx.f.rules.freeItems.includes(line.item))
		return { cost: 0, currency: line.currency };
	let p: Buy = { cost: line.cost, currency: line.currency };
	const item = ctx.f.idx.items.get(line.item);
	if (!item) return p;
	const plain: Carried = {
		item,
		line,
		fixed: false,
		stip: line.stipulations ?? {},
		kws: item.keywords.map((k) => k.kw)
	};
	const c = (buyer && carry(ctx.f, buyer.unit, line.item, false, line)) || plain;
	for (const r of priceRules(ctx)) {
		if (!r.items || !matchItem(c, r.items) || !holds(r, buyer, models, ctx)) continue;
		if (r.first && heldBefore > 0) continue;
		if (r.copy != null && copyBefore !== r.copy - 1) continue;
		p = apply(p, r);
	}
	return p;
}

/** What recruiting this entry costs when `before` of it are already in the warband. */
export function unitPrice(ctx: Ctx, models: Model[], unit: Unit, before: number, as?: Model): Buy {
	let p: Buy = { cost: unit.cost, currency: unit.currency };
	for (const r of priceRules(ctx)) {
		if (!r.entries?.some((e) => isEl(ctx.f, e, unit))) continue;
		if (r.first && before > 0) continue;
		if (!holds(r, as, models, ctx)) continue;
		p = apply(p, r);
	}
	return p;
}

const add = (t: Price, p: Buy) => {
	t[p.currency] += p.cost;
};

/** Each fighter's cost (entry, upgrades and kit), priced in roster order so "the first one" is the first listed. */
export function fighterCosts(state: WarbandState, f: Resolved, opts?: Options): Map<string, Price> {
	const ctx: Ctx = { f, state, opts };
	const models = buildModels(state, f);
	const out = new Map<string, Price>();
	const units = new Map<string, number>();
	const held = new Map<string, number>();
	for (const m of models) {
		const t: Price = { ducats: 0, glory: 0 };
		const key = unitKey(f, m.unit);
		add(t, unitPrice(ctx, models, m.unit, units.get(key) ?? 0, m));
		units.set(key, (units.get(key) ?? 0) + 1);
		for (const u of m.upgrades) add(t, u);
		const mine = new Map<string, number>();
		const paidFixed = fixedPaid(m, state, opts);
		for (const c of m.items) {
			if (!c.line) continue;
			if (c.fixed) {
				if (paidFixed) add(t, c.line);
				continue;
			}
			const id = c.item.id;
			add(t, itemPrice(ctx, models, m, c.line, held.get(id) ?? 0, mine.get(id) ?? 0));
			held.set(id, (held.get(id) ?? 0) + 1);
			mine.set(id, (mine.get(id) ?? 0) + 1);
		}
		out.set(m.fighter.id, t);
	}
	return out;
}

/** The warband's rating: what its fighters on the table are worth, in Ducats and in Glory. */
export function rating(state: WarbandState, f: Resolved, opts?: Options): Price {
	const t: Price = { ducats: 0, glory: 0 };
	for (const p of fighterCosts(state, f, opts).values()) {
		t.ducats += p.ducats;
		t.glory += p.glory;
	}
	return t;
}

/** What the stash items cost at their line prices (they are bought, but not on the table). */
export function stashCost(state: WarbandState, f: Resolved): Price {
	const t: Price = { ducats: 0, glory: 0 };
	for (const id of state.stash) {
		const l = f.idx.lines.get(id);
		if (l) add(t, l);
	}
	return t;
}

/**
 * The price of buying one more now: recruiting a unit (with any fixed kit it pays for), or a line's item for a
 * fighter (or for the stash, with no fighter).
 */
export function priceOf(
	state: WarbandState,
	f: Resolved,
	what: { unitId: string } | { lineId: string; fighterId?: string },
	opts?: Options
): Buy {
	const ctx: Ctx = { f, state, opts };
	const models = buildModels(state, f);
	if ('unitId' in what) {
		const unit = f.idx.units.get(what.unitId);
		if (!unit) throw new Error(`No unit ${what.unitId}.`);
		const key = unitKey(f, unit);
		const before = models.filter((m) => unitKey(f, m.unit) === key).length;
		const as = buildModel(state, f, newFighter(unit)) ?? undefined;
		const p = unitPrice(ctx, models, unit, before, as);
		if (as && fixedPaid(as, state, opts))
			for (const id of unit.kit.fixed ?? []) {
				const l = lineFor(f, unit, id);
				if (l?.currency === p.currency) p.cost += l.cost;
			}
		return p;
	}
	const line = f.idx.lines.get(what.lineId);
	if (!line) throw new Error(`No armoury line ${what.lineId}.`);
	const buyer = models.find((m) => m.fighter.id === what.fighterId);
	const held =
		models.reduce((n, m) => n + m.fighter.kit.filter((l) => itemOf(f, l) === line.item).length, 0) +
		state.stash.filter((l) => itemOf(f, l) === line.item).length;
	const mine = buyer?.fighter.kit.filter((l) => itemOf(f, l) === line.item).length ?? 0;
	return itemPrice(ctx, models, buyer, line, held, mine);
}

/** A fighter not yet on the roster, for checks before recruiting. */
export const newFighter = (unit: Unit, id = '(new)'): Fighter => ({
	id,
	unitId: unit.id,
	group: unit.category,
	kit: [],
	upgrades: [],
	skills: [],
	injuries: [],
	xp: 0
});
