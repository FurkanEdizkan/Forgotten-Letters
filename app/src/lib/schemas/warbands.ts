/**
 * Warband inputs and answers, shared by the builder pages, the API and the OpenAPI document. Ids name rules
 * elements (`unit:…`, `line:…`); fighters and warbands are uuids. A form flattens to strings, so the rules choice
 * travels as one `rules` field ("core-1.0.2" or "core-1.0.2+mire-front-1.0") and lists as one JSON field.
 */
import { z } from 'zod';
import { GROUPS, STATUSES } from '../warbands/types';
import { setId } from './rules';

const blank = <T extends z.ZodType>(s: T) =>
	z.preprocess((v) => (v === '' || v === null ? undefined : v), s.optional());
/** Left out: unchanged; null or '': cleared. */
const clearable = <T extends z.ZodType>(s: T) =>
	z.preprocess((v) => (v === '' ? null : v), s.nullable().optional());
const elementId = z
	.string()
	.trim()
	.min(3)
	.max(160)
	.regex(/^[a-z]+:/, 'Use an element id.');
const count = (max: number, what: string) =>
	z.coerce.number().int(`Use a whole number of ${what}.`).min(-max).max(max);

export const warbandName = z
	.string()
	.trim()
	.min(1, 'Name the warband.')
	.max(80, 'Use at most 80 characters.');
export const fighterName = z.string().trim().max(120, 'Use at most 120 characters.');
export const ducatLimit = z.coerce
	.number()
	.int('Use a whole number of Ducats.')
	.min(0, 'Use 0 to 100000 Ducats.')
	.max(100000, 'Use 0 to 100000 Ducats.');

/** `rules: "core+expansion"` (a form's one select) becomes rulesSet and rulesExpansions. */
const withRules = <S extends z.ZodType>(schema: S) =>
	z.preprocess((v) => {
		if (!v || typeof v !== 'object' || typeof (v as { rules?: unknown }).rules !== 'string')
			return v;
		const { rules, ...rest } = v as { rules: string };
		const [rulesSet, ...rulesExpansions] = rules.split('+').filter(Boolean);
		return { ...rest, rulesSet, rulesExpansions };
	}, schema);

const rulesFields = {
	/** The core version; the newest loaded one (or the campaign's) when not given. */
	rulesSet: blank(setId),
	rulesExpansions: z.array(setId).max(5).optional()
};

export const warbandCreate = withRules(
	z.object({
		name: warbandName,
		factionId: elementId,
		variantId: blank(elementId),
		/** The faction's dedication key (the Court's Sin). */
		dedication: blank(z.string().trim().min(1).max(80)),
		patronId: blank(elementId),
		/** Default: the faction's starting Ducats. */
		ducatLimit: blank(ducatLimit),
		/** Default: the faction's starting Glory. */
		unspentGlory: blank(z.coerce.number().int('Use a whole number of Glory.').min(0).max(10000)),
		ignoreLimits: z
			.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean())
			.optional(),
		/** Created from a seat: the campaign's rules, and the warband takes that seat. */
		campaignId: blank(z.uuid()),
		...rulesFields
	})
);

export const warbandImport = withRules(
	z.object({
		text: z
			.string()
			.min(1, 'Paste the Trench Companion text.')
			.max(50_000, 'That is too long for a warband.'),
		/** Trench Companion text, or a JSON export (ours or Trench Companion's). */
		format: z.enum(['text', 'json']).optional(),
		/** Games already played (R1: a campaign round of N is N - 1 games); Trench Companion's export has no round. */
		gamesPlayed: blank(z.coerce.number().int().min(0).max(100)),
		name: blank(warbandName),
		...rulesFields
	})
);

export const warbandPatch = z.object({
	version: z.coerce.number().int().min(1),
	name: warbandName.optional(),
	/** Null (or an empty form field) clears it; left out, it stays. */
	patronId: clearable(elementId),
	dedication: clearable(z.string().trim().min(1).max(80)),
	ducatLimit: blank(ducatLimit),
	stashDucats: blank(count(100000, 'Ducats')),
	unspentGlory: blank(count(10000, 'Glory')),
	notes: z.string().max(4000, 'Use at most 4000 characters.').optional(),
	gamesPlayed: blank(z.coerce.number().int().min(0, 'Use 0 to 100.').max(100, 'Use 0 to 100.')),
	victoryPoints: blank(count(1000, 'victory points')),
	failedPromotions: blank(z.coerce.number().int().min(0).max(100)),
	/** Outside a campaign: refusals become warnings. A form sends 'on', or nothing for off. */
	ignoreLimits: z
		.preprocess(
			(v) => (v === 'on' || v === 'true' ? true : v === 'off' || v === 'false' ? false : v),
			z.boolean()
		)
		.optional()
});

/** Recruit an entry, with the upgrades and the loadout (its armoury lines) picked in the dialog. */
export const recruitInput = z.object({
	unitId: elementId,
	name: blank(fighterName),
	upgrades: z.array(elementId).max(10).optional(),
	kit: z
		.array(elementId.regex(/^line:/, 'Use an armoury line id.'))
		.max(10)
		.optional()
});

/** Skills and injuries: ids (`skill:…`, `table:<id>#<roll>`) or names, matched to the rules; else kept as text. */
const refs = z.array(z.string().trim().min(1).max(120)).max(40);

export const fighterPatch = z.object({
	version: z.coerce.number().int().min(1),
	name: fighterName.optional(),
	/** Elites to promote a Troop, Troops to demote it; Dead sets the dead status. */
	group: z.enum(GROUPS).optional(),
	status: z.enum(STATUSES).optional(),
	xp: z.coerce.number().int().min(0, 'Use 0 to 1000.').max(1000, 'Use 0 to 1000.').optional(),
	scars: z.coerce.number().int().min(0, 'Use 0 to 10.').max(10, 'Use 0 to 10.').optional(),
	skills: refs.optional(),
	injuries: refs.optional()
});

export const lineInput = z.object({ lineId: elementId.regex(/^line:/, 'Use an armoury line id.') });
export const lineQuery = z.object({ line: lineInput.shape.lineId });
export const upgradeInput = z.object({ upgradeId: elementId });
export const upgradeQuery = z.object({ upgrade: elementId });
export const giveInput = lineInput.extend({ fighterId: z.uuid() });
/** Where a piece of kit is: a fighter's uuid, or the Arsenal. */
const holder = z.union([z.uuid(), z.literal('arsenal')]);
/** Move one piece of bought kit between fighters and the Arsenal (no money changes hands). */
export const moveInput = lineInput.extend({ from: holder, to: holder });
/**
 * How a piece of kit or a fighter leaves: `sell` gives half its price back (rounded up), `refund` all of it (only
 * before the first game), `delete` nothing.
 */
export const leaveMode = z.enum(['sell', 'refund', 'delete']);
export const kitLeaveQuery = lineQuery.extend({ mode: leaveMode.default('sell') });
export const fighterLeaveQuery = z.object({ mode: z.enum(['refund', 'delete']).default('delete') });
export const copyInput = z.object({ name: blank(warbandName) });
export const fireteamsInput = z.object({
	fireteams: z.array(z.tuple([z.uuid(), z.uuid()])).max(10)
});
export const locationsInput = z.object({
	locations: z
		.array(
			z.object({
				name: z.string().trim().min(1, 'Name the location.').max(120),
				note: z.string().max(2000).optional()
			})
		)
		.max(50)
});
export const exportQuery = z.object({ format: z.enum(['text', 'json']).default('text') });
export const choicesQuery = z.object({ rules: blank(z.string().max(200)) });
export const fighterParams = z.object({ id: z.uuid(), fid: z.uuid() });
export const assignInput = z.object({
	warbandId: z.uuid(),
	/** Rebuild the warband for the campaign's rules first (refused if it is not legal there). */
	recheck: z.boolean().optional()
});

export type WarbandCreate = z.infer<typeof warbandCreate>;
export type WarbandImport = z.infer<typeof warbandImport>;
export type WarbandPatch = z.infer<typeof warbandPatch>;
export type FighterPatch = z.infer<typeof fighterPatch>;

export * from './warband-answers';
