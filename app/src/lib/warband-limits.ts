/**
 * The books' building limits that are not one of the fixed Battlekit Limits: "only these items", "must carry
 * armour", "one Castigator per two Communicants", "at most 2 Goetic Powers", "no model under 80 Ducats", and the
 * like. One shape covers them: count something (a model's kit or upgrades, or the warband's models, entries or
 * kit), at least `min` and at most `max`, optionally `per` something else and only `when` something holds.
 *
 * A limit is written in a pack where its rule is printed: on a unit (`kit.limits`: for that entry's models), an
 * item (`stipulations.limits`: for models carrying it), an upgrade (`limits`: for models that have it), a Patron's
 * Skill (for models that have the Skill), or the warband's rules (`rules.limits`: for every model, or `who`).
 * Keys are kept as written in the pack (snake_case), so a pack round-trips unchanged.
 */
import { findItem, letters, sameEntry, type ArmouryCategory, type ArmouryItem, type HeldItem, type ModelState, type Upgrade } from './warband-rules';
import type { Currency } from './roster';

/** Which models: every key given must hold; within a key, any of the names. */
export interface ModelSel {
	entries?: string[];
	keywords?: string[];
	/** Upgrades by name, group ("Goetic Power") or the keyword they grant. */
	upgrades?: string[];
	skills?: string[];
	holding?: ItemSel;
	category?: ('elite' | 'troop' | 'mercenary')[];
	/** Its cost with its kit, in Ducats, is under this. */
	value_under?: number;
	/** Its base is larger than this many mm ("only a model on a 40mm base or smaller"). */
	base_over?: number;
	not?: ModelSel;
}

/** Which battlekit (priced and filed as in the armoury). */
export interface ItemSel {
	names?: string[];
	categories?: ArmouryCategory[];
	/** 1-Handed, 2-Handed, … */
	types?: string[];
	keywords?: string[];
	min_cost?: number;
	max_cost?: number;
	currency?: Currency;
	not?: ItemSel;
}

export interface Limit {
	/** Its name: a variant's limit of the same name replaces the faction's. */
	name?: string;
	/** What the builder says when it is broken. */
	text?: string;
	/** Per model (each model `who` picks): its kit, or its upgrades. */
	who?: ModelSel;
	/** Count kit by the weapons it makes up: a 2-Handed one counts two (unless the entry carries it in one hand). */
	count?: 'items' | 'weapons';
	items?: ItemSel;
	upgrades?: string[];
	/** Warband-wide: its models, the distinct entries among these present, or the kit its models carry. */
	models?: ModelSel;
	entries?: string[];
	warband_items?: ItemSel;
	min?: number;
	max?: number;
	/** `max` for each `each` (default 1) of these; `round: up` counts a part; `strict`: fewer than that. */
	per?: { models?: ModelSel; items?: ItemSel; each?: number; round?: 'up' | 'down'; strict?: boolean };
	/** Only while: the warband's other models are worth at least / under this many Ducats, or a model is or isn't in it. */
	when?: { rating_min?: number; rating_under?: number; present?: ModelSel; absent?: ModelSel };
}

/** A price the books set by rule: an entry's own, the first copy's, or a Patron Skill's discount. */
export interface PriceRule {
	/** For these items… */
	items?: ItemSel;
	/** …or recruiting these entries. */
	entries?: string[];
	/** Only when bought for (or as) such a model. */
	who?: ModelSel;
	/** Only while such a model is in the warband (a Patron Skill's "while this model is in your warband"). */
	while?: ModelSel;
	/** Only the first one in the warband (of each item, or of the entry). */
	first?: boolean;
	/** Only the Nth copy on one model ("the second Grail Devotee taken for a model is paid in Glory"). */
	copy?: number;
	cost?: number;
	currency?: Currency;
	less?: number;
	factor?: number;
}

/** A limit with the models it is about (its unit, item, upgrade or Skill) folded in. */
export type ScopedLimit = Limit & { scope?: ModelSel };

export interface LimitIssue {
	key: string;
	text: string;
	/** Broken by an action (a maximum): refuse it. Minimums and cost floors are met only by a finished list. */
	blocking: boolean;
}

export interface LimitWorld {
	models: ModelState[];
	armoury: ArmouryItem[];
	upgrades: Upgrade[];
	limits: ScopedLimit[];
}

const has = (list: string[] | undefined, name: string) => !!list?.some((x) => sameEntry(x, name));
const isName = (a: string, b: string) => letters(a) === letters(b);

export function matchItem(i: HeldItem, sel: ItemSel | undefined, armoury: ArmouryItem[]): boolean {
	if (!sel) return true;
	const a = findItem(armoury, i.name);
	if (sel.names && !has(sel.names, i.name)) return false;
	if (sel.categories && !(a && sel.categories.includes(a.category))) return false;
	// "1-Handed" and "2-Handed" differ only by their digit.
	const plain = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
	if (sel.types && !(a?.type && sel.types.some((t) => plain(t) === plain(a.type!)))) return false;
	if (sel.keywords && !(a && sel.keywords.some((k) => a.keywords.some((x) => isName(x, k))))) return false;
	const cost = a?.cost ?? i.cost;
	if (sel.min_cost != null && cost < sel.min_cost) return false;
	if (sel.max_cost != null && cost > sel.max_cost) return false;
	if (sel.currency && (a?.currency ?? i.currency) !== sel.currency) return false;
	if (sel.not && matchItem(i, sel.not, armoury)) return false;
	return true;
}

/** Does this upgrade name answer to `x`: by its name, its group, or a keyword it grants? */
function upgradeIs(name: string, x: string, upgrades: Upgrade[]) {
	if (isName(name, x)) return true;
	const u = upgrades.find((v) => isName(v.name, name));
	return !!u && ((!!u.group && sameEntry(u.group, x)) || [u.keyword, ...(u.keywords ?? [])].some((k) => !!k && isName(k, x)));
}

/** What a model is worth in Ducats: its entry and upgrades, and the kit it carries. */
export const valueOf = (m: ModelState) => (m.currency === 'ducats' ? m.cost : 0) + m.equipment.reduce((s, e) => s + (e.currency === 'ducats' ? e.cost : 0), 0);

export function matchModel(m: ModelState, sel: ModelSel | undefined, w: Pick<LimitWorld, 'armoury' | 'upgrades'>): boolean {
	if (!sel) return true;
	if (sel.entries && !sel.entries.some((x) => sameEntry(x, m.type) || (!!m.countsAs && sameEntry(x, m.countsAs)))) return false;
	if (sel.keywords && !sel.keywords.some((k) => m.keywords.some((x) => isName(x, k)))) return false;
	if (sel.upgrades && !sel.upgrades.some((x) => m.upgrades.some((u) => upgradeIs(u, x, w.upgrades)))) return false;
	if (sel.skills && !sel.skills.some((x) => [...m.skills, ...(m.injuries ?? [])].some((s) => isName(s, x) || letters(s).startsWith(letters(x))))) return false;
	if (sel.holding && !m.equipment.some((e) => matchItem(e, sel.holding, w.armoury))) return false;
	if (sel.category && !sel.category.includes(m.category)) return false;
	if (sel.value_under != null && !(valueOf(m) < sel.value_under)) return false;
	if (sel.base_over != null && !((m.base ?? 0) > sel.base_over)) return false;
	if (sel.not && matchModel(m, sel.not, w)) return false;
	return true;
}

/**
 * Kit counted as weapons: a 2-Handed weapon is two, except the first ones the entry carries in one hand
 * (`kit.heavyOneHand`: an Amalgam's two HEAVY 2-Handed weapons).
 */
function weaponCount(kit: HeldItem[], m: ModelState, armoury: ArmouryItem[]) {
	let oneHanded = m.kit.heavyOneHand ?? 0;
	return kit.reduce((n, e) => {
		const a = findItem(armoury, e.name);
		const two = /2/.test(a?.type ?? '');
		if (!two) return n + 1;
		if (oneHanded > 0 && a?.keywords.some((k) => isName(k, 'HEAVY'))) return oneHanded--, n + 1;
		return n + 2;
	}, 0);
}

const usesFloor = (s: ModelSel | undefined): boolean => !!s && (s.value_under != null || usesFloor(s.not));

/** Every limit broken now, each keyed by limit and model so an action can tell what it newly breaks. */
export function limitIssues(w: LimitWorld): LimitIssue[] {
	const active = w.models.filter((m) => m.status === 'active');
	const out: LimitIssue[] = [];
	w.limits.forEach((l, n) => {
		const label = l.text ?? l.name ?? describeLimit(l).slice(0, -1);
		const floor = usesFloor(l.models) || usesFloor(l.who) || usesFloor(l.scope);
		const countWarband = (s: { models?: ModelSel; items?: ItemSel }) =>
			s.models
				? active.filter((m) => matchModel(m, s.models, w)).length
				: active.reduce((t, m) => t + m.equipment.filter((e) => matchItem(e, s.items, w.armoury)).length, 0);
		// "The other models": the warband's worth without the ones this limit counts.
		const counted = (m: ModelState) => (l.models ? matchModel(m, l.models, w) : l.entries ? has(l.entries, m.type) : false);
		const rating = active.filter((m) => !counted(m)).reduce((s, m) => s + valueOf(m), 0);
		const c = l.when;
		if (c?.rating_min != null && rating < c.rating_min) return;
		if (c?.rating_under != null && rating >= c.rating_under) return;
		if (c?.present && !active.some((m) => matchModel(m, c.present, w))) return;
		if (c?.absent && active.some((m) => matchModel(m, c.absent, w))) return;
		let max = l.max;
		if (max != null && l.per) {
			const units = countWarband(l.per) / (l.per.each ?? 1);
			max = max * (l.per.round === 'up' ? Math.ceil(units) : Math.floor(units)) - (l.per.strict ? 1 : 0);
		}
		const check = (count: number, key: string, whose: string) => {
			if (max != null && count > max) out.push({ key: `${n}:${key}:max`, text: `${label}${whose} (${count}, at most ${Math.max(0, max)}).`, blocking: !floor });
			if (l.min != null && count < l.min) out.push({ key: `${n}:${key}:min`, text: `${label}${whose} (${count}, at least ${l.min}).`, blocking: false });
		};
		if (l.items || l.upgrades) {
			for (const m of active) {
				if (!matchModel(m, l.scope, w) || !matchModel(m, l.who, w)) continue;
				const kit = l.items ? m.equipment.filter((e) => matchItem(e, l.items, w.armoury)) : [];
				const count = l.items
					? l.count === 'weapons'
						? weaponCount(kit, m, w.armoury)
						: kit.length
					: m.upgrades.filter((u) => l.upgrades!.some((x) => upgradeIs(u, x, w.upgrades))).length;
				check(count, m.id, `: ${m.type}`);
			}
		} else if (l.entries) {
			check(l.entries.filter((x) => active.some((m) => sameEntry(x, m.type) || (!!m.countsAs && sameEntry(x, m.countsAs)))).length, 'w', '');
		} else if (l.models || l.warband_items) {
			check(countWarband({ models: l.models, items: l.warband_items }), 'w', '');
		}
	});
	return out;
}

/** What a model may take or do now (or `null`): the first blocking limit the change would newly break. */
export function newlyBroken(before: LimitWorld, after: LimitWorld): string | null {
	const had = new Set(limitIssues(before).map((i) => i.key));
	return limitIssues(after).find((i) => i.blocking && !had.has(i.key))?.text ?? null;
}

// ---------------------------------------------------------------- in words

const CATEGORY_NAMES: Record<ArmouryCategory, string> = {
	ranged: 'Ranged Weapons',
	grenade: 'Grenades',
	melee: 'Melee Weapons',
	armour: 'Armour',
	shield: 'Shields',
	equipment: 'Equipment',
	special: 'Special items'
};
const or = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '…') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`);
const coin = (c?: Currency) => (c === 'glory' ? 'Glory' : 'Ducats');

/** "2-Handed HEAVY Melee Weapons costing 10 Ducats or less". */
export function describeItems(s: ItemSel | undefined): string {
	if (!s) return 'items';
	const noun = s.names ? or(s.names) : s.categories?.length ? or(s.categories.map((c) => CATEGORY_NAMES[c] ?? c)) : 'items';
	const parts = [[...(s.types ?? []), ...(s.keywords ?? []), noun].join(' ')];
	if (s.min_cost != null && s.max_cost != null) parts.push(`costing ${s.min_cost}–${s.max_cost} ${coin(s.currency)}`);
	else if (s.min_cost != null) parts.push(`costing ${s.min_cost} ${coin(s.currency)} or more`);
	else if (s.max_cost != null) parts.push(`costing ${s.max_cost} ${coin(s.currency)} or less`);
	else if (s.currency) parts.push(`paid in ${coin(s.currency)}`);
	if (s.not) parts.push(`other than ${describeItems(s.not)}`);
	return parts.join(' ');
}

/** "Elite models with the keyword ARTILLERY, holding Rifles". */
export function describeModels(s: ModelSel | undefined, noun = 'models'): string {
	if (!s) return noun;
	const head = s.entries ? or(s.entries) : [...(s.category ?? []).map((c) => c[0].toUpperCase() + c.slice(1)), noun].join(' ');
	const parts = [head];
	if (s.keywords?.length) parts.push(`with ${or(s.keywords)}`);
	if (s.upgrades?.length) parts.push(`with the upgrade ${or(s.upgrades)}`);
	if (s.skills?.length) parts.push(`with the Skill ${or(s.skills)}`);
	if (s.holding) parts.push(`holding ${describeItems(s.holding)}`);
	if (s.value_under != null) parts.push(`worth under ${s.value_under} Ducats`);
	if (s.base_over != null) parts.push(`on a base over ${s.base_over}mm`);
	if (s.not) parts.push(`but not ${describeModels(s.not)}`);
	return parts.join(', ');
}

/** A limit in plain words, for the editor's preview and a broken rule with no text of its own. */
export function describeLimit(l: Limit): string {
	const amount = l.min != null && l.max != null ? (l.min === l.max ? `exactly ${l.min}` : `${l.min}–${l.max}`) : l.max === 0 ? 'no' : l.max != null ? `at most ${l.max}` : `at least ${l.min ?? 0}`;
	let s: string;
	if (l.items || l.upgrades) {
		const who = l.who ? `Each of ${describeModels(l.who)}` : 'Each model';
		s = l.items
			? `${who} carries ${amount} ${describeItems(l.items)}${l.count === 'weapons' ? ' (counted as weapons: a 2-Handed one is two)' : ''}`
			: `${who} has ${amount} of the upgrades ${or(l.upgrades!)}`;
	} else if (l.entries) s = `The warband has ${amount} of ${or(l.entries)}`;
	else if (l.warband_items) s = `The warband carries ${amount} ${describeItems(l.warband_items)}`;
	else s = `The warband has ${amount} ${describeModels(l.models)}`;
	if (l.per && l.max != null) {
		const each = l.per.each && l.per.each > 1 ? `${l.per.each} ` : '';
		s += ` for each ${each}${l.per.models || !l.per.items ? describeModels(l.per.models) : describeItems(l.per.items)}`;
		if (l.per.round === 'up') s += ' (a part counts)';
		if (l.per.strict) s += ', less one';
	}
	const c = l.when;
	if (c?.rating_min != null) s += `, while its other models are worth ${c.rating_min} Ducats or more`;
	if (c?.rating_under != null) s += `, while its other models are worth under ${c.rating_under} Ducats`;
	if (c?.present) s += `, while it has ${describeModels(c.present)}`;
	if (c?.absent) s += `, unless it has ${describeModels(c.absent)}`;
	return `${s}.`;
}

// ---------------------------------------------------------------- loadouts

/** A slot is one item, or a choice of items. */
export type Loadout = (string | string[])[];

/** Can these items fill slots of this loadout, each item its own slot? */
function fits(items: string[], l: Loadout): boolean {
	const slots = l.map((s) => (Array.isArray(s) ? s : [s]));
	const used = new Array(slots.length).fill(false);
	const place = (k: number): boolean => {
		if (k === items.length) return true;
		for (let s = 0; s < slots.length; s++)
			if (!used[s] && has(slots[s], items[k])) {
				used[s] = true;
				if (place(k + 1)) return true;
				used[s] = false;
			}
		return false;
	};
	return place(0);
}

/**
 * A model with loadouts ("a Greatsword, or a Polearm and Trench Shield, or …") carries the items they name only as
 * one of them: `null` if it does, else why not. `complete` also asks that one be whole.
 */
export function loadoutCheck(equipment: string[], loadouts: Loadout[], complete: boolean): string | null {
	if (!loadouts.length) return null;
	const named = (n: string) => loadouts.some((l) => l.some((s) => has(Array.isArray(s) ? s : [s], n)));
	const items = equipment.filter(named);
	const ok = loadouts.some((l) => fits(items, l) && (!complete || items.length === l.length));
	if (ok) return null;
	const say = loadouts.map((l) => l.map((s) => (Array.isArray(s) ? s.join(' or ') : s)).join(' and ')).join('; or ');
	return complete ? `It must carry one of: ${say}.` : `Only one of: ${say}.`;
}

// ---------------------------------------------------------------- reading a pack

type Err = (path: string, message: string) => void;
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

const CATEGORIES = ['ranged', 'grenade', 'melee', 'armour', 'shield', 'equipment', 'special'];

function keysOf(o: Obj, allowed: string[], path: string, err: Err) {
	for (const k of Object.keys(o)) if (!allowed.includes(k)) err(`${path}.${k}`, 'is not a key of this format');
}
function names(v: unknown, path: string, err: Err) {
	if (v == null) return undefined;
	if (!Array.isArray(v) || !v.every((x) => typeof x === 'string' || typeof x === 'number')) {
		err(path, 'must be a list of names');
		return undefined;
	}
	return v.map((x) => String(x).trim()).filter(Boolean);
}
function count(v: unknown, path: string, err: Err, frac = false) {
	if (v == null) return undefined;
	const n = Number(v);
	if (!Number.isFinite(n) || n < 0) {
		err(path, 'must be a number of 0 or more');
		return undefined;
	}
	return frac ? n : Math.round(n);
}
const defined = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

export function readItemSel(v: unknown, path: string, err: Err): ItemSel | undefined {
	if (v == null) return undefined;
	if (!isObj(v)) return err(path, 'must be { names, categories, types, keywords, min_cost, max_cost, currency, not }'), undefined;
	keysOf(v, ['names', 'categories', 'types', 'keywords', 'min_cost', 'max_cost', 'currency', 'not'], path, err);
	const categories = names(v.categories, `${path}.categories`, err)?.map((c) => c.toLowerCase());
	for (const c of categories ?? []) if (!CATEGORIES.includes(c)) err(`${path}.categories`, `"${c}" is not one of ${CATEGORIES.join(', ')}`);
	if (v.currency != null && v.currency !== 'ducats' && v.currency !== 'glory') err(`${path}.currency`, 'must be ducats or glory');
	return defined({
		names: names(v.names, `${path}.names`, err),
		categories: categories as ArmouryCategory[] | undefined,
		types: names(v.types, `${path}.types`, err),
		keywords: names(v.keywords, `${path}.keywords`, err)?.map((k) => k.toUpperCase()),
		min_cost: count(v.min_cost, `${path}.min_cost`, err),
		max_cost: count(v.max_cost, `${path}.max_cost`, err),
		currency: v.currency as Currency | undefined,
		not: readItemSel(v.not, `${path}.not`, err)
	});
}

export function readModelSel(v: unknown, path: string, err: Err): ModelSel | undefined {
	if (v == null) return undefined;
	if (!isObj(v)) return err(path, 'must be { entries, keywords, upgrades, skills, holding, category, value_under, not }'), undefined;
	keysOf(v, ['entries', 'keywords', 'upgrades', 'skills', 'holding', 'category', 'value_under', 'base_over', 'not'], path, err);
	const category = names(v.category, `${path}.category`, err)?.map((c) => c.toLowerCase());
	for (const c of category ?? []) if (!['elite', 'troop', 'mercenary'].includes(c)) err(`${path}.category`, `"${c}" is not elite, troop or mercenary`);
	return defined({
		entries: names(v.entries, `${path}.entries`, err),
		keywords: names(v.keywords, `${path}.keywords`, err)?.map((k) => k.toUpperCase()),
		upgrades: names(v.upgrades, `${path}.upgrades`, err),
		skills: names(v.skills, `${path}.skills`, err),
		holding: readItemSel(v.holding, `${path}.holding`, err),
		category: category as ModelSel['category'],
		value_under: count(v.value_under, `${path}.value_under`, err),
		base_over: count(v.base_over, `${path}.base_over`, err),
		not: readModelSel(v.not, `${path}.not`, err)
	});
}

export function readLimits(v: unknown, path: string, err: Err): Limit[] | undefined {
	if (v == null) return undefined;
	if (!Array.isArray(v)) return err(path, 'must be a list of limits'), undefined;
	return v.map((o, i) => {
		const p = `${path}[${i}]`;
		if (!isObj(o)) return err(p, 'must be a limit'), {};
		keysOf(o, ['name', 'text', 'who', 'items', 'upgrades', 'models', 'entries', 'warband_items', 'min', 'max', 'per', 'when', 'count'], p, err);
		if (o.count != null && o.count !== 'items' && o.count !== 'weapons') err(`${p}.count`, 'must be items or weapons');
		const what = ['items', 'upgrades', 'models', 'entries', 'warband_items'].filter((k) => o[k] != null);
		if (what.length !== 1) err(p, 'must count one thing: items or upgrades (per model), or models, entries or warband_items');
		if (o.min == null && o.max == null) err(p, 'needs a min or a max');
		if (o.who != null && !(o.items != null || o.upgrades != null)) err(`${p}.who`, 'is for per-model limits (items or upgrades)');
		let per: Limit['per'];
		if (o.per != null) {
			if (!isObj(o.per)) err(`${p}.per`, 'must be { models | items, each, round, strict }');
			else {
				keysOf(o.per, ['models', 'items', 'each', 'round', 'strict'], `${p}.per`, err);
				if ((o.per.models == null) === (o.per.items == null)) err(`${p}.per`, 'counts models or items');
				if (o.per.round != null && o.per.round !== 'up' && o.per.round !== 'down') err(`${p}.per.round`, 'must be up or down');
				per = defined({
					models: readModelSel(o.per.models, `${p}.per.models`, err),
					items: readItemSel(o.per.items, `${p}.per.items`, err),
					each: count(o.per.each, `${p}.per.each`, err),
					round: o.per.round as 'up' | 'down' | undefined,
					strict: o.per.strict === true || undefined
				});
			}
		}
		let when: Limit['when'];
		if (o.when != null) {
			if (!isObj(o.when)) err(`${p}.when`, 'must be { rating_min, rating_under, present, absent }');
			else {
				keysOf(o.when, ['rating_min', 'rating_under', 'present', 'absent'], `${p}.when`, err);
				when = defined({
					rating_min: count(o.when.rating_min, `${p}.when.rating_min`, err),
					rating_under: count(o.when.rating_under, `${p}.when.rating_under`, err),
					present: readModelSel(o.when.present, `${p}.when.present`, err),
					absent: readModelSel(o.when.absent, `${p}.when.absent`, err)
				});
			}
		}
		return defined({
			name: o.name == null ? undefined : String(o.name),
			text: o.text == null ? undefined : String(o.text),
			who: readModelSel(o.who, `${p}.who`, err),
			count: o.count as Limit['count'],
			items: readItemSel(o.items, `${p}.items`, err),
			upgrades: names(o.upgrades, `${p}.upgrades`, err),
			models: readModelSel(o.models, `${p}.models`, err),
			entries: names(o.entries, `${p}.entries`, err),
			warband_items: readItemSel(o.warband_items, `${p}.warband_items`, err),
			min: count(o.min, `${p}.min`, err),
			max: count(o.max, `${p}.max`, err),
			per,
			when
		});
	});
}

export function readPrices(v: unknown, path: string, err: Err): PriceRule[] | undefined {
	if (v == null) return undefined;
	if (!Array.isArray(v)) return err(path, 'must be a list of prices'), undefined;
	return v.map((o, i) => {
		const p = `${path}[${i}]`;
		if (!isObj(o)) return err(p, 'must be a price'), {};
		keysOf(o, ['items', 'entries', 'who', 'while', 'first', 'copy', 'cost', 'currency', 'less', 'factor'], p, err);
		if ((o.items == null) === (o.entries == null)) err(p, 'prices items or entries');
		if ([o.cost, o.less, o.factor].filter((x) => x != null).length !== 1) err(p, 'needs one of cost, less or factor');
		if (o.currency != null && o.currency !== 'ducats' && o.currency !== 'glory') err(`${p}.currency`, 'must be ducats or glory');
		return defined({
			items: readItemSel(o.items, `${p}.items`, err),
			entries: names(o.entries, `${p}.entries`, err),
			who: readModelSel(o.who, `${p}.who`, err),
			while: readModelSel(o.while, `${p}.while`, err),
			first: o.first === true || undefined,
			copy: count(o.copy, `${p}.copy`, err),
			cost: count(o.cost, `${p}.cost`, err),
			currency: o.currency as Currency | undefined,
			less: count(o.less, `${p}.less`, err),
			factor: count(o.factor, `${p}.factor`, err, true)
		});
	});
}

export function readLoadouts(v: unknown, path: string, err: Err): Loadout[] | undefined {
	if (v == null) return undefined;
	const ok = Array.isArray(v) && v.every((l) => Array.isArray(l) && l.every((s) => typeof s === 'string' || (Array.isArray(s) && s.every((x) => typeof x === 'string'))));
	if (!ok) return err(path, 'must be a list of loadouts, each a list of items (or [choices])'), undefined;
	return v as Loadout[];
}

export function readHands(v: unknown, path: string, err: Err): { ranged?: number; melee?: number } | undefined {
	if (v == null) return undefined;
	if (!isObj(v)) return err(path, 'must be { ranged, melee }'), undefined;
	keysOf(v, ['ranged', 'melee'], path, err);
	return defined({ ranged: count(v.ranged, `${path}.ranged`, err), melee: count(v.melee, `${path}.melee`, err) });
}

/** Every entry, item, upgrade and keyword name a limit or price mentions (for the packs' cross-check). */
export function namesIn(x: unknown): { entries: string[]; items: string[]; upgrades: string[] } {
	const out = { entries: [] as string[], items: [] as string[], upgrades: [] as string[] };
	const walk = (v: unknown, key = '') => {
		if (Array.isArray(v)) {
			if (key === 'entries') out.entries.push(...v.map(String));
			else if (key === 'names') out.items.push(...v.map(String));
			else if (key === 'upgrades') out.upgrades.push(...v.map(String));
			else v.forEach((y) => walk(y));
		} else if (isObj(v)) for (const [k, y] of Object.entries(v)) walk(y, k);
	};
	walk(x);
	return out;
}
