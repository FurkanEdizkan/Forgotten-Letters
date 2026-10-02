/**
 * Campaign progression by the Rulebook's Campaign Phase: the Trauma Table, Promotions, Experience and the Skill
 * Tables. The tables come from the book packs (`tables:` and `progression:`); these are the pure rules over them:
 * reading a pack's tables, rolling on one, when a model advances, what a Skill roll gives it, and what its skills
 * and injuries do to its profile.
 */
import { readItemSel, readLimits, type ItemSel, type Limit } from './warband-limits';

export type Dice = 'D3' | 'D6' | '2D6' | 'D66';
export type Stat = 'movement' | 'ranged' | 'melee' | 'armour';

/** What a table result does to the model, where the builder can act on it; the rest is its text. */
export interface Effects {
	dead?: boolean;
	stats?: Partial<Record<Stat, number>>;
	keywords?: string[];
	no_experience?: boolean;
	miss_next_battle?: boolean;
	retire?: boolean;
	extra_xp?: number | string;
	patron_skill?: boolean;
	pick_skill?: boolean;
	scar?: boolean;
	/** Keywords the model loses (Insomniac: INFILTRATOR). */
	remove_keywords?: string[];
	/** Building limits on the model while it has this (Muscle Damage: no HEAVY kit; Lost Arm: hands). */
	limits?: Limit[];
	/** When the result is recorded, the model loses its kit: all it can lose, or what matches (Muscle Damage: HEAVY). */
	lose_kit?: true | ItemSel;
	/** More Battle Scars it can take before it is Unfit for Duty (War-Luck). */
	extra_scars?: number;
	/** It doesn't count towards the ELITE models at the Promotion step (Bad Company). */
	not_counted_elite?: boolean;
	/** Dice it adds to the Promotion Pool (Show Off). */
	promotion_dice?: number;
	/** Experience each other ELITE model gains when Experience is recorded (War Stories). */
	xp_to_others?: number;
}

export interface TableRow {
	/** "7", or an inclusive range "2-3" / "11-16". */
	roll: string;
	name: string;
	text: string;
	effects?: Effects;
}

export interface CampaignTable {
	id: string;
	name: string;
	dice: Dice;
	source: string | null;
	text: string;
	rows: TableRow[];
}

export interface Progression {
	/** Experience totals at which a model makes an Advancement Roll. */
	advancementAt: number[];
	promotion: { baseDice: number; perGloriousDeed: number; autoAfter: number; maxElite: number };
	advancement: { tablesToPick: number; dice: Dice };
	text: string;
}

export const DICE: Dice[] = ['D3', 'D6', '2D6', 'D66'];
export const STATS: Stat[] = ['movement', 'ranged', 'melee', 'armour'];

/** Every result a die can give, in order (a D66 as tens and units: 11…16, 21…66). */
export function faces(dice: Dice): number[] {
	if (dice === 'D3') return [1, 2, 3];
	if (dice === 'D6') return [1, 2, 3, 4, 5, 6];
	if (dice === '2D6') return [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
	return [1, 2, 3, 4, 5, 6].flatMap((t) => [1, 2, 3, 4, 5, 6].map((u) => t * 10 + u));
}

const span = (roll: string): [number, number] => {
	const m = roll.match(/^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/);
	return m ? [Number(m[1]), Number(m[2] ?? m[1])] : [NaN, NaN];
};

/** The row a total lands on, or null. */
export function rowFor(t: CampaignTable, total: number): TableRow | null {
	return t.rows.find((r) => {
		const [a, b] = span(r.roll);
		return total >= a && total <= b;
	}) ?? null;
}

/** Faces no row covers, and faces more than one does (empty both: the table is whole). */
export function coverage(t: CampaignTable) {
	const counts = faces(t.dice).map((f) => [f, t.rows.filter((r) => rowFor({ ...t, rows: [r] }, f)).length] as const);
	return { missing: counts.filter(([, n]) => n === 0).map(([f]) => f), doubled: counts.filter(([, n]) => n > 1).map(([f]) => f) };
}

/** Roll the table's dice with `d6` (a function giving 1-6): the dice as rolled and their total (a D66: tens, units). */
export function roll(dice: Dice, d6: () => number): { dice: number[]; total: number } {
	if (dice === 'D3') {
		const r = d6();
		return { dice: [r], total: Math.ceil(r / 2) };
	}
	if (dice === 'D6') {
		const r = d6();
		return { dice: [r], total: r };
	}
	const a = d6();
	const b = d6();
	return { dice: [a, b], total: dice === '2D6' ? a + b : a * 10 + b };
}

const same = (a: string, b: string) => a.toLowerCase().replace(/[^a-z0-9]/g, '') === b.toLowerCase().replace(/[^a-z0-9]/g, '');

/** How many Advancement Rolls a model is owed: thresholds its Experience reached, less those it has made. */
export function advancementsDue(p: Progression, xp: number, made: number): number {
	return Math.max(0, p.advancementAt.filter((at) => xp >= at).length - made);
}

/** The next Experience total that brings an Advancement Roll, or null. */
export const nextAdvancement = (p: Progression, xp: number) => p.advancementAt.find((at) => at > xp) ?? null;

/**
 * The Skill a roll on a Skill Table gives a model that has `known` skills: the rolled one, or, if it has it, the
 * next lowest it doesn't have, else the next highest; a Patron Skill result is one of the Patron's it doesn't have.
 */
export function skillFrom(t: CampaignTable, total: number, known: string[], patronSkills: string[] = []): { name: string; text: string; patron?: boolean } | null {
	const hit = rowFor(t, total);
	if (!hit) return null;
	const has = (n: string) => known.some((k) => same(k, n));
	if (hit.effects?.patron_skill) {
		const free = patronSkills.filter((s) => !has(s));
		return { name: free.length ? free.join(' or ') : hit.name, text: hit.text, patron: true };
	}
	if (!has(hit.name)) return { name: hit.name, text: hit.text };
	const i = t.rows.indexOf(hit);
	const lower = t.rows.slice(0, i).reverse().find((r) => !has(r.name) && !r.effects?.patron_skill);
	const higher = t.rows.slice(i + 1).find((r) => !has(r.name) && !r.effects?.patron_skill);
	const r = lower ?? higher;
	return r ? { name: r.name, text: r.text } : null;
}

/** The table row a name on a model is (a skill or an injury), searching every table. */
export function rowNamed(tables: CampaignTable[], name: string): { table: CampaignTable; row: TableRow } | null {
	for (const table of tables) for (const row of table.rows) if (same(row.name, name)) return { table, row };
	return null;
}

/** What a model's skills and injuries do: summed stat changes, keywords gained and lost, and the flags that hold. */
export function effectsOf(names: string[], tables: CampaignTable[]) {
	const stats: Record<Stat, number> = { movement: 0, ranged: 0, melee: 0, armour: 0 };
	const keywords = new Set<string>();
	const removed = new Set<string>();
	let noExperience = false;
	let scars = 0;
	let extraScars = 0;
	let promotionDice = 0;
	let xpToOthers = 0;
	let notCountedElite = false;
	const unmatched: string[] = [];
	for (const n of names) {
		const hit = rowNamed(tables, n.replace(/\s*\(.*\)\s*$/, ''));
		if (!hit) {
			unmatched.push(n);
			continue;
		}
		// "Head Wound (healed)": a Promotion 6 gave back the Experience; only the Battle Scar remains.
		const e = /\(healed\)\s*$/i.test(n) ? { scar: hit.row.effects?.scar } : (hit.row.effects ?? {});
		for (const s of STATS) stats[s] += e.stats?.[s] ?? 0;
		for (const k of e.keywords ?? []) keywords.add(k.toUpperCase());
		for (const k of e.remove_keywords ?? []) removed.add(k.toUpperCase());
		if (e.no_experience) noExperience = true;
		if (e.scar) scars++;
		extraScars += e.extra_scars ?? 0;
		promotionDice += e.promotion_dice ?? 0;
		xpToOthers += e.xp_to_others ?? 0;
		if (e.not_counted_elite) notCountedElite = true;
	}
	return { stats, keywords: [...keywords], removedKeywords: [...removed], noExperience, scars, extraScars, promotionDice, xpToOthers, notCountedElite, unmatched };
}

/** A characteristic as printed ('6"/Infantry', '+1 DICE', '-1') with a change applied. */
export function applyStat(value: string | undefined, delta: number): string | undefined {
	if (!delta || value == null) return value;
	const m = value.match(/^([+-]?\d+)(.*)$/);
	if (!m) return value;
	const n = Number(m[1]) + delta;
	const signed = /^[+-]/.test(m[1]) || /DICE/i.test(m[2]);
	return `${signed && (n > 0 || (n === 0 && /DICE/i.test(m[2]))) ? '+' : ''}${n}${m[2]}`;
}

/**
 * Promotion Dice handed to the Troops (the Rulebook's order): one each in turn, never a third to one before every
 * Troop has two, and so on. Returns how many dice each Troop (by index) gets.
 */
export function assignPromotionDice(pool: number, troops: number): number[] {
	const out = new Array(troops).fill(0);
	for (let i = 0; i < pool && troops; i++) out[i % troops] += 1;
	return out;
}

/**
 * Roll Promotion Dice for each Troop one at a time, stopping at a 6; after `autoAfter` dice in a row without one,
 * the next is a 6. Returns each Troop's dice, who is promoted, and the streak carried to the next game. No more
 * than `room` Troops are promoted (the 6-ELITE cap).
 */
export function rollPromotions(dicePer: number[], streak: number, autoAfter: number, room: number, d6: () => number) {
	const results: { dice: number[]; promoted: boolean }[] = [];
	let promoted = 0;
	for (const n of dicePer) {
		const dice: number[] = [];
		let ok = false;
		for (let i = 0; i < n && !ok && promoted < room; i++) {
			const r = streak >= autoAfter ? 6 : d6();
			dice.push(r);
			if (r === 6) (ok = true), (streak = 0), promoted++;
			else streak++;
		}
		results.push({ dice, promoted: ok });
	}
	return { results, streak };
}

// ---------------------------------------------------------------- reading a pack

type Err = (path: string, message: string) => void;
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (o: Obj, allowed: string, path: string, err: Err) => {
	for (const k of Object.keys(o)) if (!allowed.split(' ').includes(k)) err(`${path}.${k}`, 'is not a key of this format');
};
const str = (v: unknown) => (v == null ? '' : String(v).trim());
const int = (v: unknown, path: string, err: Err, d: number) => {
	if (v == null) return d;
	const n = Number(v);
	if (!Number.isInteger(n)) err(path, 'must be a whole number');
	return Number.isInteger(n) ? n : d;
};

function readEffects(v: unknown, path: string, err: Err): Effects | undefined {
	if (v == null) return undefined;
	if (!isObj(v)) return err(path, 'must be a map of effects'), undefined;
	keys(v, 'dead stats keywords no_experience miss_next_battle retire extra_xp patron_skill pick_skill scar remove_keywords limits lose_kit extra_scars not_counted_elite promotion_dice xp_to_others', path, err);
	const e: Effects = {};
	for (const k of ['dead', 'no_experience', 'miss_next_battle', 'retire', 'patron_skill', 'pick_skill', 'scar'] as const) if (v[k] != null) e[k] = v[k] === true;
	if (v.stats != null) {
		if (!isObj(v.stats)) err(`${path}.stats`, 'must be { movement, ranged, melee, armour }');
		else {
			keys(v.stats, STATS.join(' '), `${path}.stats`, err);
			e.stats = Object.fromEntries(Object.entries(v.stats).map(([k, n]) => [k, int(n, `${path}.stats.${k}`, err, 0)]));
		}
	}
	if (v.keywords != null) e.keywords = Array.isArray(v.keywords) ? v.keywords.map((k) => str(k).toUpperCase()) : (err(`${path}.keywords`, 'must be a list'), []);
	if (v.extra_xp != null) e.extra_xp = typeof v.extra_xp === 'number' ? v.extra_xp : str(v.extra_xp);
	if (v.remove_keywords != null) e.remove_keywords = Array.isArray(v.remove_keywords) ? v.remove_keywords.map((k) => str(k).toUpperCase()) : (err(`${path}.remove_keywords`, 'must be a list'), []);
	const limits = readLimits(v.limits, `${path}.limits`, err);
	if (limits) e.limits = limits;
	if (v.lose_kit != null) e.lose_kit = v.lose_kit === true ? true : readItemSel(v.lose_kit, `${path}.lose_kit`, err);
	for (const k of ['extra_scars', 'promotion_dice', 'xp_to_others'] as const) if (v[k] != null) e[k] = int(v[k], `${path}.${k}`, err, 0);
	if (v.not_counted_elite != null) e.not_counted_elite = v.not_counted_elite === true;
	return e;
}

/** A pack's `tables:` list, checked (each roll covered once); errors by path. */
export function readTables(input: unknown, err: Err): CampaignTable[] {
	if (input == null) return [];
	if (!Array.isArray(input)) return err('tables', 'must be a list'), [];
	return input.flatMap((o, i) => {
		const p = `tables[${i}]`;
		if (!isObj(o)) return err(p, 'must be a table'), [];
		keys(o, 'id name dice source text rows', p, err);
		const dice = DICE.find((d) => d === str(o.dice).toUpperCase());
		if (!dice) err(`${p}.dice`, `must be one of ${DICE.join(', ')}`);
		if (!str(o.id) || !str(o.name)) err(p, 'needs an id and a name');
		const rows: TableRow[] = (Array.isArray(o.rows) ? o.rows : []).map((r: unknown, k: number) => {
			const q = `${p}.rows[${k}]`;
			if (!isObj(r)) return err(q, 'must be a row'), { roll: '', name: '', text: '' };
			keys(r, 'roll name text effects', q, err);
			if (Number.isNaN(span(str(r.roll))[0])) err(`${q}.roll`, 'must be like "7" or "2-3"');
			const effects = readEffects(r.effects, `${q}.effects`, err);
			return { roll: str(r.roll), name: str(r.name), text: str(r.text), ...(effects ? { effects } : {}) };
		});
		const t: CampaignTable = { id: str(o.id), name: str(o.name), dice: dice ?? 'D6', source: str(o.source) || null, text: str(o.text), rows };
		if (dice) {
			const c = coverage(t);
			if (c.missing.length) err(`${p}.rows`, `no row for ${c.missing.join(', ')}`);
			if (c.doubled.length) err(`${p}.rows`, `more than one row for ${c.doubled.join(', ')}`);
		}
		return [t];
	});
}

/** A pack's `progression:` settings, checked. */
export function readProgression(input: unknown, err: Err): Progression | null {
	if (input == null) return null;
	if (!isObj(input)) return err('progression', 'must be a map'), null;
	keys(input, 'advancement_at promotion advancement text', 'progression', err);
	const at = Array.isArray(input.advancement_at) ? input.advancement_at.map((n, i) => int(n, `progression.advancement_at[${i}]`, err, 0)) : [];
	const pr = isObj(input.promotion) ? input.promotion : {};
	keys(pr, 'base_dice per_glorious_deed auto_after max_elite', 'progression.promotion', err);
	const ad = isObj(input.advancement) ? input.advancement : {};
	keys(ad, 'tables_to_pick dice', 'progression.advancement', err);
	return {
		advancementAt: at.sort((a, b) => a - b),
		promotion: {
			baseDice: int(pr.base_dice, 'progression.promotion.base_dice', err, 1),
			perGloriousDeed: int(pr.per_glorious_deed, 'progression.promotion.per_glorious_deed', err, 1),
			autoAfter: int(pr.auto_after, 'progression.promotion.auto_after', err, 5),
			maxElite: int(pr.max_elite, 'progression.promotion.max_elite', err, 6)
		},
		advancement: { tablesToPick: int(ad.tables_to_pick, 'progression.advancement.tables_to_pick', err, 2), dice: DICE.find((d) => d === str(ad.dice).toUpperCase()) ?? '2D6' },
		text: str(input.text)
	};
}
