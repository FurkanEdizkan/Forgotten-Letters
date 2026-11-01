/**
 * Warband inputs and answers, shared by the builder pages, the API and the OpenAPI document. Ids name rules
 * elements (`unit:…`, `line:…`); fighters and warbands are uuids. A form flattens to strings, so the rules choice
 * travels as one `rules` field ("core-1.0.2" or "core-1.0.2+mire-front-1.0") and lists as one JSON field.
 */
import { z } from 'zod';
import { GROUPS } from '../warbands/types';
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
		patronId: blank(elementId),
		/** Default: the faction's starting Ducats. */
		ducatLimit: blank(ducatLimit),
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
	notes: z.string().max(4000, 'Use at most 4000 characters.').optional()
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
	group: z.enum(GROUPS).optional(),
	xp: z.coerce.number().int().min(0, 'Use 0 to 1000.').max(1000, 'Use 0 to 1000.').optional(),
	skills: refs.optional(),
	injuries: refs.optional()
});

export const lineInput = z.object({ lineId: elementId.regex(/^line:/, 'Use an armoury line id.') });
export const lineQuery = z.object({ line: lineInput.shape.lineId });
export const upgradeInput = z.object({ upgradeId: elementId });
export const upgradeQuery = z.object({ upgrade: elementId });
export const giveInput = lineInput.extend({ fighterId: z.uuid() });
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

// ---------------------------------------------------------------- answers

const price = z.object({ ducats: z.number().int(), glory: z.number().int() }).meta({ id: 'Price' });
const named = z.object({ id: z.string(), name: z.string() });

export const issueOut = z
	.object({
		code: z.string(),
		text: z.string(),
		fighterId: z.string().optional(),
		severity: z.enum(['error', 'warning'])
	})
	.meta({ id: 'WarbandIssue' });

export const seatRef = z
	.object({
		campaignId: z.uuid(),
		campaignName: z.string(),
		seatId: z.uuid(),
		allowBeyondLimits: z.boolean()
	})
	.meta({ id: 'WarbandSeat' });

export const fighterOut = z
	.object({
		id: z.uuid(),
		unitId: z.string(),
		unitName: z.string(),
		name: z.string().nullable(),
		group: z.enum(GROUPS),
		cost: price,
		kit: z.array(
			z.object({
				lineId: z.string().nullable(),
				itemId: z.string(),
				name: z.string(),
				fixed: z.boolean()
			})
		),
		upgrades: z.array(named),
		skills: z.array(z.object({ ref: z.string(), name: z.string() })),
		injuries: z.array(z.object({ ref: z.string(), name: z.string() })),
		xp: z.number().int(),
		/** The image's address, or null for the empty slot. */
		image: z.string().nullable(),
		version: z.number().int()
	})
	.meta({ id: 'Fighter' });

export const warbandCard = z
	.object({
		id: z.uuid(),
		name: z.string(),
		rulesSet: z.string(),
		rulesExpansions: z.array(z.string()),
		factionId: z.string(),
		factionName: z.string(),
		variantName: z.string().nullable(),
		rating: price,
		ducatLimit: z.number().int(),
		fighters: z.number().int(),
		problems: z.number().int(),
		seat: seatRef.nullable()
	})
	.meta({ id: 'WarbandCard' });

export const warbandOut = z
	.object({
		...warbandCard.shape,
		ownerId: z.uuid(),
		ownerName: z.string(),
		variantId: z.string().nullable(),
		patronId: z.string().nullable(),
		patronName: z.string().nullable(),
		dedication: z.string().nullable(),
		stashDucats: z.number().int(),
		unspentGlory: z.number().int(),
		stash: z.array(z.object({ lineId: z.string(), itemId: z.string(), name: z.string() })),
		fireteams: z.array(z.tuple([z.string(), z.string()])),
		locations: z.array(z.object({ name: z.string(), note: z.string().optional() })),
		notes: z.string(),
		fighters: z.array(fighterOut),
		/** How many fireteams the faction may form. */
		fireteamsMax: z.number().int(),
		issues: z.array(issueOut),
		/** The caller owns it; a campaign master sees it read-only. */
		canEdit: z.boolean(),
		version: z.number().int()
	})
	.meta({ id: 'Warband' });

export const warbandList = z.object({ items: z.array(warbandCard) });
export const importOut = z.object({
	warband: warbandOut,
	unmatched: z.array(z.string()),
	ambiguous: z.array(z.string())
});

const reasons = z.array(z.string());
export const recruitsOut = z.object({
	items: z.array(
		z.object({
			unitId: z.string(),
			name: z.string(),
			category: z.string(),
			cost: z.number().int(),
			currency: z.enum(['ducats', 'glory']),
			ok: z.boolean(),
			reasons,
			/** Upgrades the entry may take when it is recruited. */
			upgrades: z.array(
				z.object({
					upgradeId: z.string(),
					name: z.string(),
					cost: z.number().int(),
					currency: z.enum(['ducats', 'glory'])
				})
			),
			/** Each way to fill its loadouts, as the armoury lines to buy with it. */
			loadouts: z.array(z.object({ label: z.string(), lines: z.array(z.string()) }))
		})
	)
});
export const armouryOut = z.object({
	items: z.array(
		z.object({
			lineId: z.string(),
			itemId: z.string(),
			name: z.string(),
			category: z.string(),
			price: z.number().int(),
			currency: z.enum(['ducats', 'glory']),
			ok: z.boolean(),
			reasons
		})
	)
});
export const upgradesOut = z.object({
	items: z.array(
		z.object({
			upgradeId: z.string(),
			name: z.string(),
			cost: z.number().int(),
			currency: z.enum(['ducats', 'glory']),
			has: z.boolean(),
			ok: z.boolean(),
			reasons
		})
	)
});
export const choicesOut = z.object({
	rules: z.array(z.object({ value: z.string(), label: z.string() })),
	/** The `rules` value the choices below are for. */
	picked: z.string(),
	factions: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			alignment: z.string(),
			startDucats: z.number().int(),
			startGlory: z.number().int(),
			variants: z.array(named.extend({ startDucats: z.number().int() })),
			/** Patrons by variant id ('' for none). */
			patrons: z.record(z.string(), z.array(named))
		})
	)
});
export const campaignWarbandsOut = z.object({
	items: z.array(z.object({ seatId: z.uuid(), seatName: z.string(), warband: warbandCard }))
});

export type WarbandCreate = z.infer<typeof warbandCreate>;
export type WarbandImport = z.infer<typeof warbandImport>;
export type WarbandPatch = z.infer<typeof warbandPatch>;
export type FighterPatch = z.infer<typeof fighterPatch>;
export type ApiWarband = z.infer<typeof warbandOut>;
export type ApiWarbandCard = z.infer<typeof warbandCard>;
export type ApiFighter = z.infer<typeof fighterOut>;
export type ApiChoices = z.infer<typeof choicesOut>;
export type ApiRecruit = z.infer<typeof recruitsOut>['items'][number];
export type ApiArmouryLine = z.infer<typeof armouryOut>['items'][number];
export type ApiUpgrade = z.infer<typeof upgradesOut>['items'][number];
