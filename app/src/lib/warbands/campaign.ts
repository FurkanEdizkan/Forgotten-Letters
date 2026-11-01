/**
 * Campaign rules the builder shows and the services enforce (Rulebook, Campaign Phase): what kit sells for, when a
 * full refund is still allowed, the Threshold and field strength for the next game, the Experience marks that bring
 * an Advancement Roll, who may be Promoted, and where each of a model's keywords comes from. Pure.
 */
import type { Unit } from '../rules/pack.ts';
import type { Model } from './model.ts';
import { rating, stashCost } from './prices.ts';
import { nameOf, type Resolved } from './resolve.ts';
import { isActive, type Fighter, type Options, type Price, type WarbandState } from './types.ts';

/** Quartermaster: kit sells for half its price, rounded up, in its own currency. */
export const sellValue = (p: Price): Price => ({
	ducats: Math.ceil(p.ducats / 2),
	glory: Math.ceil(p.glory / 2)
});

/** The warband with one copy of a bought piece taken from a fighter or the Arsenal (`from`), or null if not held. */
export function withoutPiece(
	state: WarbandState,
	from: string,
	lineId: string
): WarbandState | null {
	const drop = (xs: string[]) => {
		const at = xs.lastIndexOf(lineId);
		return at < 0 ? null : xs.filter((_, i) => i !== at);
	};
	if (from === 'arsenal') {
		const stash = drop(state.stash);
		return stash && { ...state, stash };
	}
	const x = state.fighters.find((y) => y.id === from);
	const kit = x ? drop(x.kit) : null;
	if (!kit) return null;
	return { ...state, fighters: state.fighters.map((y) => (y.id === from ? { ...y, kit } : y)) };
}

/** What the warband's kit is worth: its fighters on the roster and the Arsenal at its lines' prices. */
const worth = (state: WarbandState, f: Resolved, opts?: Options): Price => {
	const a = rating(state, f, opts);
	const b = stashCost(state, f);
	return { ducats: a.ducats + b.ducats, glory: a.glory + b.glory };
};

/**
 * What one bought piece is worth to the warband now: its worth with the piece less its worth without it, so a
 * discounted first copy or a free one is worth what it saves. A refund gives this back; selling half of it.
 */
export function pieceValue(
	state: WarbandState,
	f: Resolved,
	from: string,
	lineId: string,
	opts?: Options
): Price {
	const after = withoutPiece(state, from, lineId);
	if (!after) return { ducats: 0, glory: 0 };
	const a = worth(state, f, opts);
	const b = worth(after, f, opts);
	return { ducats: a.ducats - b.ducats, glory: a.glory - b.glory };
}

/** A full refund (an undo) only while the warband has played no game: a Trench Companion convenience. */
export const canRefund = (gamesPlayed: number) => gamesPlayed === 0;

/** The Battle Scar that makes a fighter unfit for duty, and the count from which it may retire. */
export const UNFIT_AT = 3;
export const RETIRE_FROM = 2;
/** Promotion stops when the warband has this many ELITE models. */
export const MAX_ELITES = 6;
/** Limited Potential: no more Experience than this. */
export const LIMITED_XP = 7;

type Row = { roll: string; effects?: Record<string, unknown> };
const num = (v: unknown) => (typeof v === 'number' ? v : undefined);

/**
 * The Threshold (most Ducats fielded) and field strength (most models) for the warband's next game, from the
 * rules set's Threshold table, with the variant's modifier (Papal States: 200 lower). Past the table each game adds
 * its per-game step. Null when the set has no Threshold table.
 */
export function nextGame(f: Resolved, gamesPlayed: number) {
	const t = f.set.tables.find((x) => x.kind === 'threshold');
	if (!t) return null;
	const game = gamesPlayed + 1;
	const rows = t.rows as Row[];
	const fixed = rows.filter((r) => /^\d+$/.test(r.roll));
	const exact = fixed.find((r) => Number(r.roll) === game);
	const last = fixed.at(-1);
	const step = rows.find((r) => num(r.effects?.thresholdDucatsPerGame) != null)?.effects ?? {};
	let ducats: number | undefined;
	let strength: number | undefined;
	if (exact) {
		ducats = num(exact.effects?.thresholdDucats);
		strength = num(exact.effects?.fieldStrength);
	} else if (last && game > Number(last.roll)) {
		const past = game - Number(last.roll);
		ducats =
			(num(last.effects?.thresholdDucats) ?? 0) + past * (num(step.thresholdDucatsPerGame) ?? 0);
		strength =
			(num(last.effects?.fieldStrength) ?? 0) + past * (num(step.fieldStrengthPerGame) ?? 0);
	}
	if (ducats == null || strength == null) return null;
	return { game, threshold: ducats + f.rules.thresholdModifier, fieldStrength: strength };
}

/** The Experience totals that bring an Advancement Roll (the progression table's marks), lowest first. */
export function advancementMarks(f: Resolved): number[] {
	const t = f.set.tables.find((x) => x.kind === 'progression');
	const marks = (t?.rows ?? [])
		.filter((r) => r.effects?.advancement === true && /^\d+$/.test(r.roll))
		.map((r) => Number(r.roll));
	return marks.length ? marks.sort((a, b) => a - b) : [2, 4, 7, 10];
}

/** The most Experience a fighter may have: Limited Potential's cap, else none. */
export const xpMax = (unit: Pick<Unit, 'promotion'> | undefined) =>
	unit?.promotion === 'limited' ? LIMITED_XP : null;

/** ELITE models on the roster (recruited as Elites or Promoted). */
export const elites = (state: WarbandState, f: Resolved) =>
	state.fighters.filter(
		(x) => isActive(x) && (x.group === 'elite' || f.idx.units.get(x.unitId)?.category === 'elite')
	).length;

/** May this fighter be Promoted to the Elites: a Troop that can be Promoted, below the six-ELITE cap. */
export function promotion(state: WarbandState, f: Resolved, x: Fighter): string | null {
	const unit = f.idx.units.get(x.unitId);
	if (!unit) return 'Its entry is not in these rules.';
	if (x.group === 'elite' || unit.category === 'elite') return 'It is already ELITE.';
	if (unit.category === 'mercenary') return 'Mercenaries are not Promoted.';
	if (unit.promotion === 'never') return `A ${unit.name} cannot be Promoted.`;
	if (elites(state, f) >= MAX_ELITES) return `The warband already has ${MAX_ELITES} ELITE models.`;
	return null;
}

export interface KeywordSource {
	kw: string;
	value?: string | number;
	name: string;
	/** Printed on the entry, or given by something else (shown dashed, with where it comes from). */
	derived: boolean;
	from?: string;
}

/**
 * A model's keywords with where each comes from: its entry's (printed), and those given by its upgrades, the
 * faction's grant, its skills and injuries, being ELITE, the LEADER rule, a fireteam, or its kit.
 */
export function keywordSources(m: Model, f: Resolved): KeywordSource[] {
	const out: KeywordSource[] = [];
	const seen = new Set<string>();
	// A keyword the set does not define (a rule-given ELITE in a small set) reads as its id's words.
	const kwName = (kw: string) => {
		const n = nameOf(f, kw);
		return n === kw ? kw.replace(/^kw:/, '').replace(/-/g, ' ').toUpperCase() : n;
	};
	const label = (kw: string, value?: string | number) =>
		`${kwName(kw)}${value != null && value !== '' ? ` ${value}` : ''}`;
	const add = (kw: string, value: string | number | undefined, derived: boolean, from?: string) => {
		const key = `${kw}|${value ?? ''}`;
		if (seen.has(key)) return;
		seen.add(key);
		out.push({ kw, ...(value != null ? { value } : {}), name: label(kw, value), derived, from });
	};
	for (const r of m.unit.keywords) add(r.kw, r.value, false);
	for (const u of m.upgrades) for (const r of u.keywords ?? []) add(r.kw, r.value, true, u.name);
	if (m.unit.category !== 'mercenary')
		for (const r of f.rules.grant) add(r.kw, r.value, true, f.variant?.name ?? f.faction.name);
	const printed = new Set(out.map((k) => k.kw));
	for (const kw of m.keywords)
		if (!printed.has(kw)) {
			const from =
				kw === f.kw.elite
					? 'ELITE model'
					: kw === f.kw.leader
						? 'Leader'
						: kw === f.kw.fireteam
							? 'Fireteam'
							: 'Skill or injury';
			add(kw, undefined, true, from);
		}
	// Weapons' keywords are the weapon's rules; other kit's tag keywords (Loyal Hound: FIRETEAM) are the model's.
	for (const c of m.items) {
		if (c.item.category === 'ranged' || c.item.category === 'melee') continue;
		for (const r of c.item.keywords)
			if (c.kws.includes(r.kw) && f.idx.keywords.get(r.kw)?.kind !== 'effect')
				add(r.kw, r.value, true, c.item.name);
	}
	return out;
}
