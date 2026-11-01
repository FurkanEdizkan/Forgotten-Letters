/**
 * The rules folder format: one folder per rules version (`rules/core-1.0.2/`, `rules/carcass-front-1.0/`), or one
 * homebrew set in the database, in the same shape. Pure zod, shared by the loader, the compendium, the warband
 * engine, the homebrew editor and the local generator (`tools/packs`). Every reference is an id, so the links form
 * a graph (`EDGE_KINDS`). Unknown keys are refused (`strict`), so a typo never leaves a rule silently unenforced.
 *
 * Text fields hold the group's own copy of the rules and may link to other elements inline as `[[id]]` or
 * `[[id|label]]`. No book text ships with the app: the folders are git-ignored and mounted per install.
 *
 * Building rules (limits, prices, kit) follow docs/packs/LIMITS.md, with names replaced by ids.
 * Reused from archive/carcass-front-v1: src/lib/faction-template.ts and src/lib/warband-limits.ts (shapes), rewritten
 * as zod with ids.
 */
import { z } from 'zod';

// ---------------------------------------------------------------- ids and small values

/** `type:path`, lowercase: `faction:new-antioch`, `unit:new-antioch/lieutenant`, `table:trauma#11`. */
export const ID_TYPES = [
	'faction',
	'variant',
	'unit',
	'item',
	'line',
	'kw',
	'upgrade',
	'patron',
	'skill',
	'table',
	'scenario',
	'page',
	'loc'
] as const;
export type IdType = (typeof ID_TYPES)[number];
export const id = z
	.string()
	.regex(
		/^(faction|variant|unit|item|line|kw|upgrade|patron|skill|table|scenario|page|loc):[a-z0-9][a-z0-9:/#._-]*$/,
		'Use an id like unit:new-antioch/lieutenant.'
	);
export type Id = z.infer<typeof id>;
export const idOf = <T extends IdType>(type: T) =>
	id.refine((v) => v.startsWith(`${type}:`), `Use a ${type}: id.`);
/**
 * Owners that are not elements: the Mercenaries' pool owns mercenary units and their armoury lines in every set
 * (their general rules are a page). They always resolve.
 */
export const RESERVED_IDS = ['faction:mercenaries'] as const;

/** The type part of an id. */
export const typeOf = (v: string) => v.slice(0, v.indexOf(':')) as IdType;

export const ALIGNMENTS = ['faithful', 'fallen'] as const;
export const UNIT_CATEGORIES = ['elite', 'troop', 'mercenary'] as const;
export const ITEM_CATEGORIES = [
	'ranged',
	'melee',
	'grenade',
	'armour',
	'shield',
	'equipment',
	'special'
] as const;
export const ITEM_TYPES = [
	'1-Handed',
	'2-Handed',
	'Grenade',
	'Armour',
	'Shield',
	'Equipment',
	'Special'
] as const;
export const CURRENCIES = ['ducats', 'glory'] as const;

const text = z.string().max(20_000);
const name = z.string().min(1).max(120);
const count = z.number().int().min(0);

/** A keyword on a unit or item, with its value where it takes one (AUTOMATIC 2, NEGATE [FIRE]). */
export const kwRef = z
	.object({ kw: idOf('kw'), value: z.union([z.string(), z.number()]).optional() })
	.strict();

// ---------------------------------------------------------------- selectors, limits, prices (LIMITS.md)

export type ItemSel = {
	items?: string[];
	categories?: (typeof ITEM_CATEGORIES)[number][];
	types?: (typeof ITEM_TYPES)[number][];
	keywords?: string[];
	minCost?: number;
	maxCost?: number;
	currency?: (typeof CURRENCIES)[number];
	not?: ItemSel;
};
export const itemSel: z.ZodType<ItemSel> = z.lazy(() =>
	z
		.object({
			items: z.array(idOf('item')).optional(),
			categories: z.array(z.enum(ITEM_CATEGORIES)).optional(),
			types: z.array(z.enum(ITEM_TYPES)).optional(),
			keywords: z.array(idOf('kw')).optional(),
			minCost: count.optional(),
			maxCost: count.optional(),
			currency: z.enum(CURRENCIES).optional(),
			not: itemSel.optional()
		})
		.strict()
);

export type ModelSel = {
	units?: string[];
	keywords?: string[];
	/** Upgrade ids, or an upgrade group name ("Goetic Power"). */
	upgrades?: string[];
	skills?: string[];
	holding?: ItemSel;
	category?: (typeof UNIT_CATEGORIES)[number][];
	valueUnder?: number;
	baseOver?: number;
	not?: ModelSel;
	/** Matches when any of these match ("X or Y only" across different keys). */
	any?: ModelSel[];
};
export const modelSel: z.ZodType<ModelSel> = z.lazy(() =>
	z
		.object({
			units: z.array(idOf('unit')).optional(),
			keywords: z.array(idOf('kw')).optional(),
			upgrades: z.array(z.string().min(1)).optional(),
			skills: z.array(idOf('skill')).optional(),
			holding: itemSel.optional(),
			category: z.array(z.enum(UNIT_CATEGORIES)).optional(),
			valueUnder: count.optional(),
			baseOver: count.optional(),
			not: modelSel.optional(),
			any: z.array(modelSel).optional()
		})
		.strict()
);

/** A limit counts exactly one of: items, upgrades, models, entries, warbandItems. */
export const limit = z
	.object({
		name: z.string().max(120).optional(),
		text: z.string().max(300).optional(),
		min: count.optional(),
		max: count.optional(),
		items: itemSel.optional(),
		upgrades: z.array(z.string().min(1)).optional(),
		models: modelSel.optional(),
		entries: z.array(idOf('unit')).optional(),
		warbandItems: itemSel.optional(),
		who: modelSel.optional(),
		count: z.enum(['weapons']).optional(),
		per: z
			.object({
				models: modelSel.optional(),
				items: itemSel.optional(),
				each: z.number().int().min(1).optional(),
				round: z.enum(['up', 'down']).optional(),
				strict: z.boolean().optional()
			})
			.strict()
			.optional(),
		when: z
			.object({
				ratingMin: count.optional(),
				ratingUnder: count.optional(),
				present: modelSel.optional(),
				absent: modelSel.optional(),
				/** A campaign switch: the limit applies only when option `key` has `value` (41-open-questions). */
				option: z
					.object({ key: z.string(), value: z.union([z.string(), z.boolean()]) })
					.strict()
					.optional()
			})
			.strict()
			.optional()
	})
	.strict()
	.refine(
		(l) =>
			[l.items, l.upgrades, l.models, l.entries, l.warbandItems].filter((x) => x !== undefined)
				.length === 1,
		'A limit counts exactly one of items, upgrades, models, entries or warbandItems.'
	)
	.refine((l) => l.min !== undefined || l.max !== undefined, 'A limit needs min or max.');
export type Limit = z.infer<typeof limit>;

export const priceRule = z
	.object({
		items: itemSel.optional(),
		entries: z.array(idOf('unit')).optional(),
		first: z.boolean().optional(),
		copy: z.number().int().min(1).optional(),
		cost: count.optional(),
		currency: z.enum(CURRENCIES).optional(),
		less: count.optional(),
		factor: z.number().positive().optional(),
		who: modelSel.optional(),
		while: modelSel.optional()
	})
	.strict();
export type PriceRule = z.infer<typeof priceRule>;

/** What an armoury line (or a unit's own override of one) asks of whoever carries it. */
export const stipulations = z
	.object({
		only: modelSel.optional(),
		perModel: count.optional(),
		shieldCombo: z.boolean().optional(),
		bayonetLug: z.boolean().optional(),
		consumable: z.boolean().optional(),
		headgear: z.boolean().optional(),
		explorationOnly: z.boolean().optional(),
		dropKeywords: z.array(idOf('kw')).optional(),
		limits: z.array(limit).optional(),
		limitExcludes: modelSel.optional()
	})
	.strict();

// ---------------------------------------------------------------- elements

export const manifest = z
	.object({
		id: z.string().regex(/^[a-z0-9][a-z0-9.-]*$/),
		name,
		kind: z.enum(['core', 'expansion', 'homebrew']),
		version: z.string().min(1).max(40),
		/** Expansions and homebrew name the folder (or set) they build on. */
		base: z.string().optional(),
		released: z.iso.date().optional(),
		notes: text.optional()
	})
	.strict()
	.refine((m) => m.kind === 'core' || !!m.base, 'An expansion or homebrew names its base.');
export type Manifest = z.infer<typeof manifest>;

export const keyword = z
	.object({
		id: idOf('kw'),
		name,
		kind: z.enum(['tag', 'effect', 'both']),
		/** The value it takes: X (a number), X" (a distance), keyword (another keyword). */
		param: z.enum(['X', 'X"', 'keyword']).optional(),
		text,
		aliases: z.array(name).optional()
	})
	.strict();

export const item = z
	.object({
		id: idOf('item'),
		name,
		category: z.enum(ITEM_CATEGORIES),
		type: z.enum(ITEM_TYPES),
		range: z.string().max(40).optional(),
		keywords: z.array(kwRef),
		text: text.optional(),
		lore: text.optional(),
		unique: z.boolean().optional(),
		/** Other names it goes by, for import matching ("Great Sword/Axe"). */
		aliases: z.array(name).optional()
	})
	.strict();

/** What one faction, variant, mercenary pool or Glory table charges for an item. */
export const armouryLine = z
	.object({
		id: idOf('line'),
		owner: id,
		item: idOf('item'),
		cost: count,
		currency: z.enum(CURRENCIES),
		limit: count.optional(),
		stipulations: stipulations.optional()
	})
	.strict();

export const unit = z
	.object({
		id: idOf('unit'),
		/** A faction, a variant (its own or replacing entries) or `faction:mercenaries`. */
		owner: id,
		name,
		category: z.enum(UNIT_CATEGORIES),
		availability: z.object({ min: count, max: count.nullable() }).strict(),
		cost: count,
		currency: z.enum(CURRENCIES),
		stats: z
			.object({
				movement: z.string().max(20),
				ranged: z.string().max(20),
				melee: z.string().max(20),
				armour: z.string().max(20),
				base: z.string().max(20)
			})
			.partial()
			.strict(),
		keywords: z.array(kwRef),
		abilities: z.array(z.object({ name, text }).strict()),
		upgrades: z.array(idOf('upgrade')).optional(),
		kit: z
			.object({
				fixed: z.array(idOf('item')).optional(),
				/** The fixed kit's price is in the unit's cost (Q65). */
				includedInCost: z.boolean().optional(),
				nothingElse: z.boolean().optional(),
				except: z.array(z.enum(ITEM_CATEGORIES)).optional(),
				hands: z.object({ ranged: count, melee: count }).partial().strict().optional(),
				loadouts: z.array(z.array(z.union([idOf('item'), z.array(idOf('item'))]))).optional(),
				countsAs: idOf('unit').optional(),
				recruit: z.boolean().optional(),
				heavyOneHand: count.optional(),
				items: z.record(z.string(), stipulations).optional(),
				limits: z.array(limit).optional()
			})
			.strict(),
		/** Campaign: `never` cannot be Promoted to ELITE; `limited` has at most 7 Experience (Limited Potential). */
		promotion: z.enum(['never', 'limited']).optional(),
		hiredBy: z
			.object({ alignment: z.enum(ALIGNMENTS).optional(), factions: z.array(id).optional() })
			.strict()
			.optional(),
		text: text.optional(),
		lore: text.optional(),
		aliases: z.array(name).optional()
	})
	.strict();

export const upgrade = z
	.object({
		id: idOf('upgrade'),
		owner: id,
		name,
		group: z.string().max(60).optional(),
		keywords: z.array(kwRef).optional(),
		cost: count,
		currency: z.enum(CURRENCIES),
		max: count.optional(),
		/** May be bought for a model already on the roster (Q37: otherwise only at recruitment). */
		afterRecruit: z.boolean().optional(),
		for: z.array(idOf('unit')).optional(),
		hands: z.object({ ranged: count, melee: count }).partial().strict().optional(),
		limits: z.array(limit).optional(),
		text: text.optional()
	})
	.strict();

const factionRules = {
	startDucats: count,
	startGlory: count,
	fireteams: count.optional(),
	leader: idOf('unit').optional(),
	mustInclude: z.array(idOf('unit')).optional(),
	caps: z.array(z.object({ unit: idOf('unit'), max: count }).strict()).optional(),
	excluded: z.array(id).optional(),
	freeItems: z.array(idOf('item')).optional(),
	limits: z.array(limit).optional(),
	prices: z.array(priceRule).optional(),
	/** The Patron the warband must serve. */
	patron: idOf('patron').optional(),
	/** Keywords every model of the warband has (Undead Horror, Rampant Charge); its Mercenaries do not. */
	grant: z.array(kwRef).optional(),
	/** Added to the campaign Threshold (Papal States: -200). */
	thresholdModifier: z.number().int().optional()
};

export const faction = z
	.object({
		id: idOf('faction'),
		name,
		alignment: z.enum(ALIGNMENTS),
		...factionRules,
		/**
		 * A Sin, a dedication: chosen before recruiting (Q63). `variant` names the overlay the choice lays over the
		 * faction (its units, lines and rules), like a variant; the warband stores the key, not the variant.
		 */
		dedications: z
			.array(z.object({ key: z.string(), name, variant: idOf('variant').optional() }).strict())
			.optional(),
		mercenaries: z.array(idOf('unit')).optional(),
		/** The warband must take one of this faction's variants (it is never fielded bare). */
		requiresVariant: z.boolean().optional(),
		/** Which Glory item and exploration tables it uses (Q91). */
		gloryTable: id.optional(),
		text: text.optional(),
		lore: text.optional()
	})
	.strict();

/** A variant overlays its faction: same-named rule keys replace the faction's, entries are replaced or added. */
export const variant = z
	.object({
		id: idOf('variant'),
		faction: idOf('faction'),
		name,
		replaces: z.array(z.object({ from: id, to: id }).strict()).optional(),
		adds: z.array(id).optional(),
		excludes: z.array(id).optional(),
		rules: z.object(factionRules).partial().strict().optional(),
		text: text.optional(),
		lore: text.optional()
	})
	.strict();

export const patron = z
	.object({
		id: idOf('patron'),
		name,
		alignment: z.enum(ALIGNMENTS).optional(),
		factions: z.array(id).optional(),
		text: text.optional(),
		skills: z.array(
			z
				.object({
					id: idOf('skill'),
					name,
					text,
					prices: z.array(priceRule).optional(),
					limits: z.array(limit).optional()
				})
				.strict()
		)
	})
	.strict();

export const table = z
	.object({
		id: idOf('table'),
		name,
		kind: z.enum([
			'skill',
			'trauma',
			'survival',
			'threshold',
			'progression',
			'exploration',
			'glory',
			'other'
		]),
		dice: z.string().max(20).optional(),
		/** The faction, Patron or expansion it belongs to. */
		owner: id.optional(),
		rows: z.array(
			z
				.object({
					roll: z.string().max(20),
					name,
					text: text.optional(),
					/** Structured effects for later steps; free-form until step 6 defines them. */
					effects: z.record(z.string(), z.unknown()).optional(),
					/** A row that gives an item, a skill or another table. */
					links: z.array(id).optional()
				})
				.strict()
		)
	})
	.strict();

export const scenario = z
	.object({
		id: idOf('scenario'),
		name,
		text,
		deployment: text.optional(),
		victory: text.optional()
	})
	.strict();

export const COMPENDIUM_SECTIONS = [
	'core-rules',
	'warbands',
	'comprehensive-rules',
	'battlekit',
	'campaigns',
	'scenarios',
	'errata'
] as const;
/** A rule text section for the compendium: its body may link elements as [[id]]. */
export const page = z
	.object({
		id: idOf('page'),
		section: z.enum(COMPENDIUM_SECTIONS),
		title: name,
		order: z.number().int(),
		parent: idOf('page').optional(),
		body: text
	})
	.strict();

export const legalList = z
	.object({
		target: id,
		name,
		legal: z.boolean(),
		/** For an illegal list: a phrase from the problem it must raise. */
		expect: z.string().optional(),
		patron: idOf('patron').optional(),
		dedication: z.string().optional(),
		models: z.array(
			z
				.object({
					unit: idOf('unit'),
					n: z.number().int().min(1).optional(),
					kit: z.array(idOf('item')).optional(),
					upgrades: z.array(idOf('upgrade')).optional(),
					skills: z.array(idOf('skill')).optional()
				})
				.strict()
		)
	})
	.strict();

/** File name → its schema. Missing files are empty lists; `manifest.json` is required. */
export const FILES = {
	'keywords.json': z.array(keyword),
	'items.json': z.array(item),
	'armoury-lines.json': z.array(armouryLine),
	'factions.json': z.array(faction),
	'variants.json': z.array(variant),
	'units.json': z.array(unit),
	'upgrades.json': z.array(upgrade),
	'patrons.json': z.array(patron),
	'tables.json': z.array(table),
	'scenarios.json': z.array(scenario),
	'legal-lists.json': z.array(legalList)
} as const;

/** A whole rules set, as loaded (pages come from `pages/*.json`). */
export const rulesSet = z
	.object({
		manifest,
		keywords: FILES['keywords.json'].default([]),
		items: FILES['items.json'].default([]),
		armouryLines: FILES['armoury-lines.json'].default([]),
		factions: FILES['factions.json'].default([]),
		variants: FILES['variants.json'].default([]),
		units: FILES['units.json'].default([]),
		upgrades: FILES['upgrades.json'].default([]),
		patrons: FILES['patrons.json'].default([]),
		tables: FILES['tables.json'].default([]),
		scenarios: FILES['scenarios.json'].default([]),
		legalLists: FILES['legal-lists.json'].default([]),
		pages: z.array(page).default([])
	})
	.strict();
export type RulesSet = z.infer<typeof rulesSet>;
export type Keyword = z.infer<typeof keyword>;
export type Item = z.infer<typeof item>;
export type ArmouryLine = z.infer<typeof armouryLine>;
export type Unit = z.infer<typeof unit>;
export type Upgrade = z.infer<typeof upgrade>;
export type Faction = z.infer<typeof faction>;
export type Variant = z.infer<typeof variant>;
export type Patron = z.infer<typeof patron>;
export type Table = z.infer<typeof table>;
export type Scenario = z.infer<typeof scenario>;
export type Page = z.infer<typeof page>;
export type LegalList = z.infer<typeof legalList>;
export type Stipulations = z.infer<typeof stipulations>;

/** How elements connect; the loader derives these from the ids above (and `[[id]]` links in text). */
export const EDGE_KINDS = [
	'belongs_to', // unit/line/upgrade → its owner; variant → faction; skill → patron
	'may_take', // unit or owner → armoury line (and line → item)
	'fixed_kit', // unit → item
	'has_keyword', // unit/item/upgrade → keyword
	'has_upgrade', // unit → upgrade
	'replaces', // variant entry → base entry
	'adds', // variant → added entry
	'excludes', // variant → removed entry
	'counts_as', // unit → unit
	'hires', // faction → mercenary unit
	'serves', // patron → faction
	'mentions', // any → an id named in its text
	'restricts' // limit/stipulation/price → an id it names
] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];
export interface Edge {
	from: string;
	to: string;
	kind: EdgeKind;
}
