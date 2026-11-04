/**
 * The rules API's inputs and answers: which set (a folder name, its base chain included), searches, one element
 * with its links and neighbourhood, and the difference between two versions. Shared by the API, the compendium
 * pages and the OpenAPI document.
 */
import { z } from 'zod';
import { EDGE_KINDS, ID_TYPES, id } from '../rules/pack';

/** A rules folder name (core-1.0.2, carcass-front-1.0) or a homebrew set (hb:<uuid>). */
export const setId = z
	.string()
	.max(80)
	.regex(
		/^([a-z0-9][a-z0-9.-]*|hb:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/,
		'Use a rules folder name like core-1.0.2.'
	);

export const nodesQuery = z.object({
	set: setId,
	q: z.string().trim().max(80).optional(),
	type: z.enum(ID_TYPES).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(50)
});

export const nodeQuery = z.object({
	set: setId,
	id,
	/** How far the neighbourhood graph reaches. */
	depth: z.coerce.number().int().min(1).max(2).default(2)
});

export const diffQuery = z.object({ from: setId, to: setId });

// ---------------------------------------------------------------- answers

export const problemOut = z
	.object({ file: z.string(), id: z.string().optional(), message: z.string() })
	.meta({ id: 'RulesProblem' });

export const ruleSetOut = z
	.object({
		id: z.string(),
		name: z.string(),
		kind: z.enum(['core', 'expansion', 'homebrew']).nullable(),
		version: z.string().nullable(),
		base: z.string().nullable(),
		/** Not an official release (its manifest says `preview`). */
		preview: z.boolean(),
		checksum: z.string(),
		ok: z.boolean(),
		loadedAt: z.iso.datetime(),
		problems: z.array(problemOut),
		/** Elements per type, for a loaded set. */
		counts: z.record(z.string(), z.number().int())
	})
	.meta({ id: 'RulesSet' });
export type RuleSetOut = z.infer<typeof ruleSetOut>;
export const ruleSetList = z.object({ items: z.array(ruleSetOut) });

export const nodeHead = z
	.object({ id: z.string(), type: z.enum(ID_TYPES), name: z.string(), setId: z.string() })
	.meta({ id: 'RulesElement' });
export type NodeHead = z.infer<typeof nodeHead>;
export const nodePage = z.object({ items: z.array(nodeHead), next: z.null() });

export const linkOut = z
	.object({
		kind: z.enum(EDGE_KINDS),
		id: z.string(),
		type: z.enum(ID_TYPES),
		name: z.string()
	})
	.meta({ id: 'RulesLink' });
export type LinkOut = z.infer<typeof linkOut>;

export const graphOut = z.object({
	nodes: z.array(
		z.object({ id: z.string(), type: z.enum(ID_TYPES), name: z.string(), depth: z.number().int() })
	),
	links: z.array(z.object({ from: z.string(), to: z.string(), kind: z.enum(EDGE_KINDS) }))
});
export type GraphOut = z.infer<typeof graphOut>;

export const nodeOut = z.object({
	node: nodeHead.extend({ data: z.record(z.string(), z.unknown()) }),
	out: z.array(linkOut),
	in: z.array(linkOut),
	graph: graphOut
});
export type NodeOut = z.infer<typeof nodeOut>;

const value = z.union([z.string(), z.number(), z.boolean(), z.null()]).optional();
const diffHead = z.object({ id: z.string(), type: z.enum(ID_TYPES), name: z.string() });
export const diffOut = z.object({
	from: z.string(),
	to: z.string(),
	added: z.array(diffHead),
	removed: z.array(diffHead),
	changed: z.array(
		diffHead.extend({ fields: z.array(z.object({ path: z.string(), from: value, to: value })) })
	)
});
export type DiffOut = z.infer<typeof diffOut>;
