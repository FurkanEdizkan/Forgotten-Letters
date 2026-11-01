/**
 * Homebrew inputs and answers, shared by the homebrew pages, the API and the OpenAPI document. The set's data is
 * a whole rules set in the rules folder format; its content is checked by the rules checker (a draft that fails is
 * saved with its report), so the schema here only bounds its shape and size.
 */
import { z } from 'zod';
import { HOMEBREW_KINDS } from '../rules/homebrew';
import { problemOut, setId } from './rules';

const blank = <T extends z.ZodType>(s: T) =>
	z.preprocess((v) => (v === '' || v === null ? undefined : v), s.optional());
const elementId = z
	.string()
	.trim()
	.min(3)
	.max(160)
	.regex(/^[a-z]+:/, 'Use an element id.');

export const homebrewName = z
	.string()
	.trim()
	.min(1, 'Name it.')
	.max(80, 'Use at most 80 characters.');

export const HOMEBREW_STARTS = ['faction', 'variant', 'items', 'copy'] as const;

/**
 * A new set: a blank faction, a blank variant of `of` (an official or homebrew faction), a blank set of items, or
 * a copy of `of` (a faction or variant), built on the rules set `base`.
 */
export const homebrewCreate = z
	.object({
		name: homebrewName,
		base: setId,
		start: z.enum(HOMEBREW_STARTS),
		of: blank(elementId)
	})
	.refine((v) => !['variant', 'copy'].includes(v.start) || !!v.of, {
		path: ['of'],
		message: 'Pick the faction or variant it starts from.'
	});

const list = z.array(z.unknown()).max(2000).optional();
/** A whole set, as the editor holds it; unknown keys are refused so nothing is silently dropped. */
export const homebrewData = z
	.object({
		manifest: z.unknown(),
		keywords: list,
		items: list,
		armouryLines: list,
		factions: list,
		variants: list,
		units: list,
		upgrades: list,
		patrons: list,
		tables: list,
		scenarios: list,
		legalLists: list,
		pages: list
	})
	.strict();

export const homebrewUpdate = z.object({
	version: z.coerce.number().int().min(1),
	name: homebrewName.optional(),
	data: homebrewData
});

/** An exported set: its files keyed by name (`manifest.json`, `units.json`, …). */
export const homebrewImport = z.object({
	files: z.record(z.string().max(80), z.unknown()),
	name: blank(homebrewName)
});

export const homebrewParams = z.object({ id: z.uuid() });

/** The import form: the exported file's text (the page reads a picked file into it), then as the API takes it. */
export const homebrewImportForm = z
	.object({ text: z.string().trim().min(1, 'Pick a file or paste its text.').max(3_000_000) })
	.transform((v, c) => {
		try {
			return { files: JSON.parse(v.text) as unknown };
		} catch {
			c.addIssue({
				code: 'custom',
				path: ['text'],
				message: 'That is not JSON. Pick the file the export saved.'
			});
			return z.NEVER;
		}
	})
	.pipe(homebrewImport);

/** Share (on) or make private (off), from the Sharing tab. */
export const homebrewShareForm = z.object({
	on: z.enum(['true', 'false']).transform((v) => v === 'true')
});

// ---------------------------------------------------------------- answers

export const homebrewCard = z
	.object({
		id: z.uuid(),
		/** Its id in the rules cache and the compendium: hb:<id>. */
		setId: z.string(),
		name: z.string(),
		kind: z.enum(HOMEBREW_KINDS),
		baseSet: z.string(),
		/** The base's name and version, for people. */
		baseName: z.string(),
		visibility: z.enum(['private', 'shared']),
		ownerId: z.uuid(),
		ownerName: z.string(),
		mine: z.boolean(),
		/** The current version passes its checks. */
		ok: z.boolean(),
		/** The current version's problems. */
		problems: z.number().int(),
		/**
		 * The version players build with (the last that passed) and when it was checked; null when no version has
		 * passed. While a newer draft has problems, this stays on the older version.
		 */
		published: z.object({ version: z.number().int(), checkedAt: z.iso.datetime() }).nullable(),
		version: z.number().int(),
		updatedAt: z.iso.datetime()
	})
	.meta({ id: 'HomebrewCard' });
export type ApiHomebrewCard = z.output<typeof homebrewCard>;

export const homebrewOut = z
	.object({
		...homebrewCard.shape,
		data: z.record(z.string(), z.unknown()),
		report: z.array(problemOut),
		copiedFrom: z.string().nullable()
	})
	.meta({ id: 'Homebrew' });
export type ApiHomebrew = z.output<typeof homebrewOut>;

export const homebrewList = z.object({
	mine: z.array(homebrewCard),
	shared: z.array(homebrewCard)
});

export type HomebrewCreate = z.infer<typeof homebrewCreate>;
export type HomebrewUpdate = z.infer<typeof homebrewUpdate>;
export type HomebrewImport = z.infer<typeof homebrewImport>;
