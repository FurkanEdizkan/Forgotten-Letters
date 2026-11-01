/**
 * The books' building limits beyond the fixed Battlekit Limits, in one shape (docs/packs/LIMITS.md): count one
 * thing (a model's kit or upgrades, or the warband's models, entries or kit), at least `min` and at most `max`,
 * optionally `per` something else and only `when` something holds. A broken `max` refuses the action that breaks
 * it; `min` limits and value floors are met only by a finished list.
 *
 * Reused from archive/carcass-front-v1:app/src/lib/warband-limits.ts (limitIssues, newlyBroken, loadoutCheck,
 * weaponCount) and app/src/lib/builder-state.ts (scoped limits), rewritten to ids and the rules folder format.
 */
import type { Limit, ModelSel } from '../rules/pack.ts';
import { describeLimit } from './describe.ts';
import { negates, valueOf, type Carried, type Model } from './model.ts';
import { isEl, nameOf } from './resolve.ts';
import { matchItem, matchModel, upgradeIs, type Ctx } from './select.ts';
import { switchesOf } from './types.ts';

/** A limit with the models it is about (its unit, item, upgrade or Skill) folded in. */
export type ScopedLimit = Limit & { scope?: ModelSel; fighterId?: string; line?: string };

export interface LimitIssue {
	key: string;
	text: string;
	fighterId?: string;
	/** A maximum an action breaks: refuse it. Minimums and value floors wait for the finished list. */
	blocking: boolean;
	/** It depends on what the other models are worth (Q39: checked at the action, a warning afterwards). */
	moving: boolean;
}

/** Every limit in force: the warband's, each entry's, each item's carriers', each upgrade's, each Skill's. */
export function scopedLimits(models: Model[], ctx: Ctx): ScopedLimit[] {
	const { f, state } = ctx;
	const sc = (ls: Limit[] | undefined, scope?: ModelSel): ScopedLimit[] =>
		(ls ?? []).map((l) => ({ ...l, scope }));
	const units = [...f.units, ...f.mercenaries];
	const itemOf = (key: string) => (key.startsWith('line:') ? f.idx.lines.get(key)?.item : key);
	const patron = state.patronId ? f.idx.patrons.get(state.patronId) : undefined;
	const pools = new Set(f.mercenaries.map((u) => u.owner));
	return [
		...sc(f.rules.limits),
		...units.flatMap((u) => sc(u.kit.limits, { units: [u.id] })),
		...units.flatMap((u) =>
			Object.entries(u.kit.items ?? {}).flatMap(([k, s]) => {
				const item = itemOf(k);
				return item ? sc(s.limits, { units: [u.id], holding: { items: [item] } }) : [];
			})
		),
		// A line's limits are for the models that bought the item from that line (stipulations are the line's, not
		// the item's): fixed kit, or a Mercenary's own copy from its pool, is not bound by the faction's line.
		...[...f.lines, ...f.set.armouryLines.filter((l) => pools.has(l.owner))].flatMap((l) =>
			sc(l.stipulations?.limits, { holding: { items: [l.item] } }).map((x) => ({
				...x,
				line: l.id
			}))
		),
		...f.upgrades.flatMap((u) => sc(u.limits, { upgrades: [u.id] })),
		...(patron?.skills ?? []).flatMap((s) => sc(s.limits, { skills: [s.id] })),
		...models.flatMap((m) => m.limits.map((l) => ({ ...l, fighterId: m.fighter.id })))
	];
}

/**
 * Kit counted as weapons: a 2-Handed weapon is two, except the first HEAVY ones the entry carries in one hand
 * (`kit.heavyOneHand`).
 */
export function weaponCount(kit: Carried[], m: Model, heavy: string): number {
	let oneHand = m.unit.kit.heavyOneHand ?? 0;
	return kit.reduce((n, c) => {
		if (c.item.type !== '2-Handed') return n + 1;
		if (oneHand > 0 && c.kws.includes(heavy)) {
			oneHand--;
			return n + 1;
		}
		return n + 2;
	}, 0);
}

const usesFloor = (s: ModelSel | undefined): boolean =>
	!!s && (s.valueUnder != null || usesFloor(s.not) || !!s.any?.some(usesFloor));

/** Every limit broken now, each keyed by limit and model, so an action can tell what it newly breaks. */
export function limitIssues(models: Model[], limits: ScopedLimit[], ctx: Ctx): LimitIssue[] {
	const { f, state, opts } = ctx;
	const switches = switchesOf(state, opts);
	const out: LimitIssue[] = [];
	limits.forEach((l, n) => {
		const label = l.text ?? l.name ?? describeLimit(f, l).slice(0, -1);
		const floor = usesFloor(l.models) || usesFloor(l.who) || usesFloor(l.scope);
		const c = l.when;
		const moving = c?.ratingMin != null || c?.ratingUnder != null;
		if (c?.option && String(switches[c.option.key]) !== String(c.option.value)) return;
		const countWarband = (s: { models?: ModelSel; items?: Limit['items'] }) =>
			s.models
				? models.filter((m) => matchModel(m, s.models, ctx)).length
				: models.reduce((t, m) => t + m.items.filter((x) => matchItem(x, s.items)).length, 0);
		// "The other models": what the warband is worth without the ones this limit counts.
		const counted = (m: Model) =>
			l.models
				? matchModel(m, l.models, ctx)
				: l.entries
					? l.entries.some((e) => isEl(f, e, m.unit))
					: false;
		if (moving) {
			const rating = models
				.filter((m) => !counted(m))
				.reduce((s, m) => s + valueOf(m, state, opts), 0);
			if (c?.ratingMin != null && rating < c.ratingMin) return;
			if (c?.ratingUnder != null && rating >= c.ratingUnder) return;
		}
		if (c?.present && !models.some((m) => matchModel(m, c.present, ctx))) return;
		if (c?.absent && models.some((m) => matchModel(m, c.absent, ctx))) return;
		let max = l.max;
		if (max != null && l.per) {
			const units = countWarband(l.per) / (l.per.each ?? 1);
			max =
				max * (l.per.round === 'up' ? Math.ceil(units) : Math.floor(units)) -
				(l.per.strict ? 1 : 0);
		}
		const check = (count: number, key: string, whose: string, fighterId?: string) => {
			// "Outnumbered by" (a strict per) binds the models it counts: with none of them it holds.
			if (max != null && count > max && !(l.per && count === 0))
				out.push({
					key: `${n}:${key}:max`,
					text: `${label}${whose} (${count}, at most ${Math.max(0, max)}).`,
					fighterId,
					blocking: !floor,
					moving
				});
			if (l.min != null && count < l.min)
				out.push({
					key: `${n}:${key}:min`,
					text: `${label}${whose} (${count}, at least ${l.min}).`,
					fighterId,
					blocking: false,
					moving
				});
		};
		if (l.items || l.upgrades) {
			for (const m of models) {
				if (l.fighterId && m.fighter.id !== l.fighterId) continue;
				if (l.line && !m.items.some((c) => !c.fixed && c.line?.id === l.line)) continue;
				if (!matchModel(m, l.scope, ctx) || !matchModel(m, l.who, ctx)) continue;
				const kit = l.items ? m.items.filter((x) => matchItem(x, l.items)) : [];
				const count = l.items
					? l.count === 'weapons'
						? weaponCount(kit, m, f.kw.heavy)
						: kit.length
					: m.upgrades.filter((u) => l.upgrades!.some((x) => upgradeIs(f, u, x))).length;
				check(count, m.fighter.id, `: ${nameOf(f, m.unit.id)}`, m.fighter.id);
			}
		} else if (l.entries) {
			const present = l.entries.filter((e) => models.some((m) => isEl(f, e, m.unit)));
			check(present.length, 'w', '');
		} else check(countWarband({ models: l.models, items: l.warbandItems }), 'w', '');
	});
	return out;
}

/** The blocking limits a change newly breaks (empty: none). */
export function newlyBroken(before: LimitIssue[], after: LimitIssue[]): string[] {
	const had = new Set(before.map((i) => i.key));
	return after.filter((i) => i.blocking && !had.has(i.key)).map((i) => i.text);
}

/** A slot is one item, or a choice of items. */
export type Loadout = (string | string[])[];

/** Can these items fill slots of this loadout, each item its own slot? */
function fits(items: string[], l: Loadout): boolean {
	const slots = l.map((s) => (Array.isArray(s) ? s : [s]));
	const used = new Array<boolean>(slots.length).fill(false);
	const place = (k: number): boolean => {
		if (k === items.length) return true;
		for (let s = 0; s < slots.length; s++)
			if (!used[s] && slots[s]!.includes(items[k]!)) {
				used[s] = true;
				if (place(k + 1)) return true;
				used[s] = false;
			}
		return false;
	};
	return place(0);
}

/**
 * A model with loadouts carries the items they name only as one of them: null if it does, else why not.
 * `complete` also asks that one be whole.
 */
export function loadoutCheck(
	itemIds: string[],
	loadouts: Loadout[],
	complete: boolean,
	name: (id: string) => string
): string | null {
	if (!loadouts.length) return null;
	const named = new Set(loadouts.flat(2));
	const items = itemIds.filter((i) => named.has(i));
	if (loadouts.some((l) => fits(items, l) && (!complete || items.length === l.length))) return null;
	const say = loadouts
		.map((l) => l.map((s) => (Array.isArray(s) ? s.map(name).join(' or ') : name(s))).join(' and '))
		.join('; or ');
	return complete ? `It must carry one of: ${say}.` : `Only one of: ${say}.`;
}

/** Does a model shrug off HEAVY's one-piece rule: STRONG, or NEGATE HEAVY. */
export const ignoresHeavy = (m: Model, ctx: Ctx) =>
	m.keywords.has(ctx.f.kw.strong) || negates(m, ctx.f, ctx.f.kw.heavy);
