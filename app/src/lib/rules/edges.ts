/**
 * The links between elements, derived from the ids in a rules set (`EDGE_KINDS` in pack.ts): what belongs to what,
 * what a unit may take or carries, keywords, upgrades, variant changes, hiring, Patrons, `[[id]]` mentions in text,
 * and `restricts` for every id named inside a limit, price, stipulation or faction rule. The checker resolves every
 * edge's target, so an edge is also how a reference is found.
 */
import { ID_TYPES, type Edge, type EdgeKind, type RulesSet } from './pack';
import { linksIn } from './text';

const ID = new RegExp(`^(${ID_TYPES.join('|')}):[a-z0-9][a-z0-9:/#._-]*$`);

/** Is `s` shaped like an id? Group names ("Goetic Power") and plain words are not. */
export const isId = (s: string) => ID.test(s);

/** The element an id points at: a table row `table:trauma#11` is part of `table:trauma`. */
export const target = (id: string) => id.split('#')[0]!;

/** Every id-shaped string anywhere in `v` (object keys too: a unit's per-item stipulations are keyed by item). */
export function idsIn(v: unknown, out = new Set<string>()): Set<string> {
	if (typeof v === 'string') {
		if (isId(v)) out.add(v);
	} else if (Array.isArray(v)) for (const x of v) idsIn(x, out);
	else if (v && typeof v === 'object')
		for (const [k, x] of Object.entries(v)) {
			if (isId(k)) out.add(k);
			idsIn(x, out);
		}
	return out;
}

export function edgesOf(set: RulesSet): Edge[] {
	const seen = new Map<string, Edge>();
	const add = (from: string, to: string | undefined | null, kind: EdgeKind) => {
		if (!to) return;
		const e = { from, to: target(to), kind };
		if (e.to !== from) seen.set(`${e.from} ${e.to} ${kind}`, e);
	};
	const all = (from: string, ids: (string | undefined)[] | undefined, kind: EdgeKind) =>
		ids?.forEach((id) => add(from, id, kind));
	const restricts = (from: string, ...values: unknown[]) => {
		for (const id of idsIn(values)) add(from, id, 'restricts');
	};
	const keywords = (from: string, refs: { kw: string }[] | undefined) =>
		refs?.forEach((r) => add(from, r.kw, 'has_keyword'));
	// Links are looked for in the element's JSON, so a nested array such as a loadout slot (`[["item:a","item:b"]]`)
	// also looks like `[[…]]`; only captures that are whole ids count.
	const mentions = (from: string, value: unknown) =>
		all(from, linksIn(JSON.stringify(value ?? '')).filter(isId), 'mentions');

	for (const k of set.keywords) mentions(k.id, k);
	for (const i of set.items) {
		keywords(i.id, i.keywords);
		mentions(i.id, i);
	}
	for (const l of set.armouryLines) {
		add(l.id, l.owner, 'belongs_to');
		add(l.id, l.item, 'may_take');
		restricts(l.id, l.stipulations);
	}
	for (const u of set.units) {
		add(u.id, u.owner, 'belongs_to');
		keywords(u.id, u.keywords);
		all(u.id, u.upgrades, 'has_upgrade');
		all(u.id, u.kit.fixed, 'fixed_kit');
		all(u.id, u.kit.loadouts?.flat(2), 'may_take');
		add(u.id, u.kit.countsAs, 'counts_as');
		restricts(u.id, u.kit.items, u.kit.limits);
		u.hiredBy?.factions?.forEach((f) => add(f, u.id, 'hires'));
		mentions(u.id, u);
	}
	for (const up of set.upgrades) {
		add(up.id, up.owner, 'belongs_to');
		keywords(up.id, up.keywords);
		restricts(up.id, up.for, up.limits);
		mentions(up.id, up);
	}
	for (const f of set.factions) {
		all(f.id, f.mercenaries, 'hires');
		const { leader, mustInclude, caps, excluded, freeItems, limits, prices, patron, gloryTable } =
			f;
		restricts(
			f.id,
			leader,
			mustInclude,
			caps,
			excluded,
			freeItems,
			limits,
			prices,
			patron,
			gloryTable
		);
		mentions(f.id, f);
	}
	for (const v of set.variants) {
		add(v.id, v.faction, 'belongs_to');
		v.replaces?.forEach((r) => add(r.to, r.from, 'replaces'));
		all(v.id, v.adds, 'adds');
		all(v.id, v.excludes, 'excludes');
		restricts(v.id, v.rules);
		mentions(v.id, v);
	}
	for (const p of set.patrons) {
		all(p.id, p.factions, 'serves');
		for (const s of p.skills) {
			add(s.id, p.id, 'belongs_to');
			restricts(s.id, s.prices, s.limits);
			mentions(s.id, s);
		}
		mentions(p.id, { ...p, skills: [] });
	}
	for (const t of set.tables) {
		add(t.id, t.owner, 'belongs_to');
		for (const r of t.rows) all(t.id, r.links, 'mentions');
		mentions(t.id, t);
	}
	for (const s of set.scenarios) mentions(s.id, s);
	for (const p of set.pages) {
		add(p.id, p.parent, 'belongs_to');
		mentions(p.id, p);
	}
	return [...seen.values()];
}
