/**
 * The warband engine's own shapes: a warband as the builder stores it (ids only, checked with zod at every
 * boundary), the options a check runs under, and what checks return. The engine is pure: no I/O, no server code,
 * so the builder page, the services and the local legal-list runner share it.
 *
 * Reused from archive/carcass-front-v1:app/src/lib/warband-rules.ts (WarbandState, Check), rewritten to ids and the
 * rules folder format.
 */
import { z } from 'zod';

export const GROUPS = ['elite', 'troop', 'mercenary', 'special', 'dead'] as const;
export type Group = (typeof GROUPS)[number];

/**
 * A fighter's campaign status (Rulebook, Trauma Step): on the roster (active, misses the next game, captured) or
 * gone from it (unfit for duty at the third Battle Scar, retired, dead). The old `dead` group reads as dead.
 */
export const STATUSES = ['active', 'misses_next', 'captured', 'unfit', 'retired', 'dead'] as const;
export type Status = (typeof STATUSES)[number];
/** Statuses that keep a fighter on the roster: it counts for the rating and the limits. */
export const ON_ROSTER: readonly Status[] = ['active', 'misses_next', 'captured'];

const lineId = z.string().regex(/^line:/, 'Use the line id the kit was bought from (line:…).');

const price = z.object({ ducats: z.number().int(), glory: z.number().int() }).strict();
export type Price = z.infer<typeof price>;

export const fighterSchema = z
	.object({
		id: z.string().min(1).max(80),
		unitId: z.string().min(1),
		name: z.string().max(120).optional(),
		group: z.enum(GROUPS),
		/**
		 * Bought kit, as the armoury line each piece was bought from (`line:…`), so its price and stipulations are that
		 * line's. The unit's fixed kit is implied and never listed here.
		 */
		kit: z.array(lineId),
		upgrades: z.array(z.string().min(1)),
		/** Skill ids (`skill:…`) or table rows (`table:<id>#<roll>`). */
		skills: z.array(z.string().min(1)),
		/** Table rows (`table:trauma#11`) or free text. */
		injuries: z.array(z.string().min(1)),
		xp: z.number().int().min(0),
		status: z.enum(STATUSES).optional(),
		/** Battle Scars: the third makes the fighter unfit for duty. */
		scars: z.number().int().min(0).optional(),
		/** What was recorded as paid (an import's totals, a campaign purchase); the engine always prices by rule. */
		paid: price.optional()
	})
	.strict();
export type Fighter = z.infer<typeof fighterSchema>;

export const warbandStateSchema = z
	.object({
		setId: z.string().min(1),
		name: z.string().max(120).optional(),
		factionId: z.string().min(1),
		variantId: z.string().min(1).optional(),
		patronId: z.string().min(1).optional(),
		/** A dedication key of the faction (a Sin, Q63). Also readable by limits as the switch `dedication`. */
		dedication: z.string().min(1).optional(),
		/** The most the fighters may be worth in Ducats (the rating cap). */
		ducatLimit: z.number().int().min(0),
		/** The Ducats bank: purchases are paid from it. */
		stashDucats: z.number().int(),
		/** The Glory bank: Glory purchases are paid from it. */
		unspentGlory: z.number().int(),
		fighters: z.array(fighterSchema),
		/** Kit held in the stash (arsenal), as the lines it was bought from. */
		stash: z.array(lineId),
		fireteams: z.array(z.tuple([z.string(), z.string()])),
		locations: z.array(
			z.object({ name: z.string().min(1).max(120), note: z.string().max(2000).optional() }).strict()
		)
	})
	.strict();
export type WarbandState = z.infer<typeof warbandStateSchema>;

/** A campaign switch value (`q37`, …, the numbers of the open rule questions) or `dedication`. */
export type Switches = Record<string, string | boolean>;

export interface Options {
	/** The campaign master lets this warband go beyond limits: issues become warnings (the checks still say why). */
	allowBeyondLimits?: boolean;
	switches?: Switches;
	/** Exploration-only kit may be bought (the campaign master opened it). */
	openExploration?: boolean;
	/** For canUpgrade: the fighter is already on the roster, not being recruited (Q37). */
	later?: boolean;
}

/**
 * The defaults of the open rule questions the engine branches on (41-open-questions): `a` is the first reading.
 * A caller's switches win. Q40's writers disagree; the packs behave as (b), so (b) is the default here.
 */
export const SWITCH_DEFAULTS: Switches = {
	q37: 'a',
	q39: 'a',
	q40: 'b',
	q44: 'a',
	q45: 'a',
	q46: 'a',
	q47: 'a',
	q48: 'a',
	q50: 'a',
	q59: 'a',
	q60: 'a',
	q64: 'a',
	q65: 'a',
	q66: 'a',
	q67: 'a',
	q72: 'a'
};

export const switchesOf = (
	state: Pick<WarbandState, 'dedication'>,
	opts: Options = {}
): Switches => ({
	...SWITCH_DEFAULTS,
	...(state.dedication ? { dedication: state.dedication } : {}),
	...opts.switches
});

export type Check = { ok: true } | { ok: false; reasons: string[] };
export const OK: Check = { ok: true };
export const no = (...reasons: string[]): Check => ({ ok: false, reasons });

export interface Issue {
	code: string;
	text: string;
	fighterId?: string;
	severity: 'error' | 'warning';
}

/** Lowercase letters only: names compare this way ("Great-Sword" is "great sword"). */
export const letters = (s: string) =>
	s
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]/g, '');
/** "yeomen" is "yeoman", "pilgrims" is "pilgrim" (already through `letters`). */
const singular = (s: string) =>
	s
		.replace(/men$/, 'man')
		.replace(/ies$/, 'y')
		.replace(/(ch|sh|x|ss)es$/, '$1')
		.replace(/s$/, '');
/** The same name but for a plural; never one name inside another ("Raiders" is not "Anointed Raiders"). */
export const sameName = (a: string, b: string) => singular(letters(a)) === singular(letters(b));

export const isActive = (f: Pick<Fighter, 'group' | 'status'>) =>
	f.group !== 'dead' && ON_ROSTER.includes(f.status ?? 'active');
export const coin = (c: 'ducats' | 'glory') => (c === 'glory' ? 'Glory' : 'Ducats');
