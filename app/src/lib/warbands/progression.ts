/**
 * Campaign progression over the rules set's tables: rolling on a table, the row a roll lands on, what a Skill roll
 * gives a model that already has some, Experience thresholds, Promotion dice, and what a model's skills and
 * injuries do to it (stats, keywords gained and lost, building limits). Pure; dice come in as a function.
 *
 * Reused from archive/carcass-front-v1:app/src/lib/progression.ts, rewritten to ids and the rules folder format.
 */
import type { Table } from '../rules/pack.ts';
import { letters } from './types.ts';

export type Row = Table['rows'][number];
export const STATS = ['movement', 'ranged', 'melee', 'armour'] as const;
export type Stat = (typeof STATS)[number];

/**
 * Is a change good for the fighter: more Movement, Ranged and Melee are; Armour is a modifier on the Injury Rolls it
 * suffers, so lower is. Null for no change.
 */
export const statTone = (stat: Stat, delta: number): 'better' | 'worse' | null =>
	!delta ? null : (stat === 'armour' ? -delta : delta) > 0 ? 'better' : 'worse';

/** Every result a table's dice can give, in order (a D66 as tens and units: 11…16, 21…66). */
export function faces(dice = 'D6'): number[] {
	const d = dice.toUpperCase();
	if (d === 'D3') return [1, 2, 3];
	if (d === '2D6') return [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
	if (d === 'D66')
		return [1, 2, 3, 4, 5, 6].flatMap((t) => [1, 2, 3, 4, 5, 6].map((u) => t * 10 + u));
	return [1, 2, 3, 4, 5, 6];
}

const span = (roll: string): [number, number] => {
	const m = roll.match(/^\s*(\d+)\s*(?:[-–]\s*(\d+))?\s*$/);
	return m ? [Number(m[1]), Number(m[2] ?? m[1])] : [NaN, NaN];
};

/** The row a total lands on, or null. */
export const rowFor = (t: Table, total: number): Row | null =>
	t.rows.find((r) => {
		const [a, b] = span(r.roll);
		return total >= a && total <= b;
	}) ?? null;

/** Faces no row covers, and faces more than one does (both empty: the table is whole). */
export function coverage(t: Table) {
	const n = (f: number) => t.rows.filter((r) => rowFor({ ...t, rows: [r] }, f)).length;
	const all = faces(t.dice);
	return { missing: all.filter((f) => n(f) === 0), doubled: all.filter((f) => n(f) > 1) };
}

/** Roll a table's dice with `d6` (giving 1-6): the dice as rolled and their total (a D66: tens, then units). */
export function roll(
	dice: string | undefined,
	d6: () => number
): { dice: number[]; total: number } {
	const d = (dice ?? 'D6').toUpperCase();
	if (d === 'D3' || d === 'D6') {
		const r = d6();
		return { dice: [r], total: d === 'D3' ? Math.ceil(r / 2) : r };
	}
	const a = d6();
	const b = d6();
	return { dice: [a, b], total: d === '2D6' ? a + b : a * 10 + b };
}

/** The row a fighter's skill or injury names: `table:<id>#<roll>`, else a row of that name in any table. */
export function rowOf(ref: string, tables: Table[]): { table: Table; row: Row } | null {
	const hash = ref.indexOf('#');
	if (ref.startsWith('table:') && hash > 0) {
		const table = tables.find((t) => t.id === ref.slice(0, hash));
		const n = Number(ref.slice(hash + 1));
		const row =
			table && (table.rows.find((r) => r.roll === ref.slice(hash + 1)) ?? rowFor(table, n));
		return table && row ? { table, row } : null;
	}
	const name = letters(ref.replace(/\s*\(.*\)\s*$/, ''));
	for (const table of tables)
		for (const row of table.rows) if (letters(row.name) === name) return { table, row };
	return null;
}

/**
 * The Skill a roll gives a model that has `known` skills: the rolled one, or if it has it the next lowest it lacks,
 * else the next highest. A Patron result (effects.patronSkill) offers the Patron's Skills it lacks.
 */
export function skillFrom(t: Table, total: number, known: string[], patronSkills: string[] = []) {
	const hit = rowFor(t, total);
	if (!hit) return null;
	const has = (n: string) => known.some((k) => letters(k) === letters(n));
	const patron = (r: Row) => !!(r.effects?.patronSkill ?? r.effects?.patron_skill);
	if (patron(hit)) {
		const free = patronSkills.filter((s) => !has(s));
		return { name: free.length ? free.join(' or ') : hit.name, row: hit, patron: true };
	}
	if (!has(hit.name)) return { name: hit.name, row: hit };
	const i = t.rows.indexOf(hit);
	const ok = (r: Row) => !has(r.name) && !patron(r);
	const r = t.rows.slice(0, i).reverse().find(ok) ?? t.rows.slice(i + 1).find(ok);
	return r ? { name: r.name, row: r } : null;
}

const get = (e: Record<string, unknown>, camel: string) =>
	e[camel] ?? e[camel.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)];
const list = (v: unknown) =>
	Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
/** A keyword an effect names: an id as is, a name as `kw:<name>`. */
const kwId = (k: string) =>
	k.startsWith('kw:') ? k : `kw:${k.toLowerCase().trim().replace(/\s+/g, '-')}`;

/** What one skill or injury does: its row, its effects, and its stat changes. */
export function effectOf(ref: string, tables: Table[]) {
	const hit = rowOf(ref, tables);
	if (!hit) return null;
	// "(healed)": a Promotion gave back the Experience; only the Battle Scar remains.
	const all = hit.row.effects ?? {};
	const effects = /\(healed\)\s*$/i.test(ref) ? { scar: all.scar } : all;
	const s = get(effects, 'stats');
	const stats = Object.fromEntries(
		STATS.map((k) => [
			k,
			s && typeof s === 'object' ? Number((s as Record<string, unknown>)[k] ?? 0) || 0 : 0
		])
	) as Record<Stat, number>;
	return { row: hit.row, effects, stats };
}

/** What a model's skills and injuries do: summed stat changes, keywords gained and lost, limits, and flags. */
export function effectsOf(refs: string[], tables: Table[]) {
	const stats: Record<Stat, number> = { movement: 0, ranged: 0, melee: 0, armour: 0 };
	const keywords = new Set<string>();
	const removed = new Set<string>();
	const limits: unknown[] = [];
	const unmatched: string[] = [];
	let noExperience = false;
	let scars = 0;
	for (const ref of refs) {
		const hit = effectOf(ref, tables);
		if (!hit) {
			unmatched.push(ref);
			continue;
		}
		const e = hit.effects;
		for (const k of STATS) stats[k] += hit.stats[k];
		for (const k of list(get(e, 'keywords'))) keywords.add(kwId(k));
		for (const k of list(get(e, 'removeKeywords'))) removed.add(kwId(k));
		const l = get(e, 'limits');
		if (Array.isArray(l)) limits.push(...l);
		if (get(e, 'noExperience') === true) noExperience = true;
		if (e.scar === true) scars++;
	}
	return {
		stats,
		keywords: [...keywords],
		removed: [...removed],
		limits,
		noExperience,
		scars,
		unmatched
	};
}

/** A characteristic as printed ('6"/Infantry', '+1 DICE', '-1') with a change applied. */
export function applyStat(value: string | undefined, delta: number): string | undefined {
	if (!delta || value == null) return value;
	const m = value.match(/^([+-]?\d+)(.*)$/);
	if (!m) return value;
	const n = Number(m[1]) + delta;
	const dice = /DICE/i.test(m[2] ?? '');
	const signed = /^[+-]/.test(m[1] ?? '') || dice;
	return `${signed && (n > 0 || (n === 0 && dice)) ? '+' : ''}${n}${m[2]}`;
}

/** How many Advancement Rolls a model is owed: thresholds its Experience reached, less those it made. */
export const advancementsDue = (at: number[], xp: number, made: number) =>
	Math.max(0, at.filter((x) => xp >= x).length - made);

/** The next Experience total that brings an Advancement Roll, or null. */
export const nextAdvancement = (at: number[], xp: number) =>
	[...at].sort((a, b) => a - b).find((x) => x > xp) ?? null;

/** Promotion Dice go round the Troops one at a time: no Troop gets a third before every Troop has two. */
export function assignPromotionDice(pool: number, troops: number): number[] {
	const out = new Array<number>(troops).fill(0);
	for (let i = 0; i < pool && troops; i++) out[i % troops]! += 1;
	return out;
}

/**
 * Roll each Troop's Promotion Dice, stopping at a 6; after `autoAfter` misses in a row the next die is a 6. At most
 * `room` Troops are promoted (the six-ELITE cap). Returns each Troop's dice and the streak carried on.
 */
export function rollPromotions(
	dicePer: number[],
	streak: number,
	autoAfter: number,
	room: number,
	d6: () => number
) {
	const results: { dice: number[]; promoted: boolean }[] = [];
	let promoted = 0;
	for (const n of dicePer) {
		const dice: number[] = [];
		let ok = false;
		for (let i = 0; i < n && !ok && promoted < room; i++) {
			const r = streak >= autoAfter ? 6 : d6();
			dice.push(r);
			if (r === 6) {
				ok = true;
				streak = 0;
				promoted++;
			} else streak++;
		}
		results.push({ dice, promoted: ok });
	}
	return { results, streak };
}
