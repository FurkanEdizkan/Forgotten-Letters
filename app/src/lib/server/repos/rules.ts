/**
 * The rules cache: rules.sets, rules.nodes and rules.edges. The only SQL for them. Reads take a chain of set ids
 * (a core and its expansions), since each set stores only its own elements.
 */
import { and, asc, count, eq, inArray, or, sql } from 'drizzle-orm';
import type { Tx } from '../db';
import {
	ruleEdges,
	ruleNodes,
	ruleSets,
	type RuleEdgeRow,
	type RuleNodeRow,
	type RuleSetRow
} from '../db/schema';

export type { RuleEdgeRow, RuleNodeRow, RuleSetRow };
export type NodeHead = Pick<RuleNodeRow, 'setId' | 'id' | 'type' | 'name'>;

/** Rows per insert: well under Postgres's 65,535 parameters, and each statement stays short of the timeout. */
const CHUNK = 1000;
/** Two reloads at once would interleave their deletes and inserts; this lock runs them one after the other. */
const RELOAD_LOCK = 7_314_201;

async function inChunks<T>(rows: T[], insert: (part: T[]) => Promise<unknown>) {
	for (let i = 0; i < rows.length; i += CHUNK) await insert(rows.slice(i, i + CHUNK));
}

export type BuiltSet = {
	row: typeof ruleSets.$inferInsert;
	nodes: Omit<RuleNodeRow, 'setId'>[];
	edges: Omit<RuleEdgeRow, 'setId'>[];
};

/** Hold the cache for this transaction: a reload and a homebrew save run one after the other. */
export const lockCache = (tx: Tx) => tx.execute(sql`select pg_advisory_xact_lock(${RELOAD_LOCK})`);

/** Replace the whole cache with these sets (inside the caller's transaction). */
export async function replaceAll(tx: Tx, sets: BuiltSet[]) {
	await lockCache(tx);
	// Nodes and edges cascade from their set.
	await tx.delete(ruleSets);
	await insertSets(tx, sets);
}

/** Replace just these sets (a homebrew save), under the caller's lock. */
export async function replaceSets(tx: Tx, sets: BuiltSet[]) {
	if (!sets.length) return;
	await tx.delete(ruleSets).where(
		inArray(
			ruleSets.id,
			sets.map((s) => s.row.id)
		)
	);
	await insertSets(tx, sets);
}

export const removeSet = (tx: Tx, id: string) => tx.delete(ruleSets).where(eq(ruleSets.id, id));

/** Every element id of these sets (a base chain's ids, for checking a homebrew set on it). */
export const nodeIds = async (tx: Tx, setIds: string[]) =>
	(
		await tx.select({ id: ruleNodes.id }).from(ruleNodes).where(inArray(ruleNodes.setId, setIds))
	).map((r) => r.id);

async function insertSets(tx: Tx, sets: BuiltSet[]) {
	for (const s of sets) {
		await tx.insert(ruleSets).values(s.row);
		const setId = s.row.id;
		await inChunks(s.nodes, (part) =>
			tx.insert(ruleNodes).values(part.map((n) => ({ ...n, setId })))
		);
		await inChunks(s.edges, (part) =>
			tx.insert(ruleEdges).values(part.map((e) => ({ ...e, setId })))
		);
	}
}

export const listSets = (tx: Tx) => tx.select().from(ruleSets).orderBy(asc(ruleSets.id));

/** How many elements of each type each set holds. */
export const countsByType = (tx: Tx) =>
	tx
		.select({ setId: ruleNodes.setId, type: ruleNodes.type, n: count() })
		.from(ruleNodes)
		.groupBy(ruleNodes.setId, ruleNodes.type);

const head = {
	setId: ruleNodes.setId,
	id: ruleNodes.id,
	type: ruleNodes.type,
	name: ruleNodes.name
};

/** Elements whose name contains `q` (ignoring case), by name. */
export function search(
	tx: Tx,
	setIds: string[],
	opts: { q?: string; type?: string; limit: number }
): Promise<NodeHead[]> {
	const like = opts.q ? `%${opts.q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
	return tx
		.select(head)
		.from(ruleNodes)
		.where(
			and(
				inArray(ruleNodes.setId, setIds),
				like ? sql`lower(${ruleNodes.name}) like ${like}` : undefined,
				opts.type ? eq(ruleNodes.type, opts.type) : undefined
			)
		)
		.orderBy(sql`lower(${ruleNodes.name})`, asc(ruleNodes.id))
		.limit(opts.limit);
}

/** Every element's id, type and name (the compendium's link labels). */
export const heads = (tx: Tx, setIds: string[]): Promise<NodeHead[]> =>
	tx.select(head).from(ruleNodes).where(inArray(ruleNodes.setId, setIds));

/** Whole elements of these types; every type when `types` is empty. */
export const nodesOfTypes = (tx: Tx, setIds: string[], types: string[]) =>
	tx
		.select()
		.from(ruleNodes)
		.where(
			and(
				inArray(ruleNodes.setId, setIds),
				types.length ? inArray(ruleNodes.type, types) : undefined
			)
		);

export const nodesByIds = (tx: Tx, setIds: string[], ids: string[]) =>
	ids.length
		? tx
				.select()
				.from(ruleNodes)
				.where(and(inArray(ruleNodes.setId, setIds), inArray(ruleNodes.id, ids)))
		: Promise.resolve([] as RuleNodeRow[]);

/** Edges starting or ending at any of `ids`. */
export const edgesTouching = (tx: Tx, setIds: string[], ids: string[]) =>
	ids.length
		? tx
				.select()
				.from(ruleEdges)
				.where(
					and(
						inArray(ruleEdges.setId, setIds),
						or(inArray(ruleEdges.fromId, ids), inArray(ruleEdges.toId, ids))
					)
				)
		: Promise.resolve([] as RuleEdgeRow[]);
