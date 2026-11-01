/**
 * Rules data: reads the mounted rules folders at start and on the Owner's Reload, checks each one (a folder that
 * fails is not loaded and keeps its report), and caches the elements and their links in the rules schema in one
 * transaction. Then answers the compendium: the sets, searches, elements with their links in and out and their
 * neighbourhood, and what changed between two versions. A set is read with its base chain (an expansion plus its
 * core), later sets replacing elements of the same id.
 *
 * Homebrew sets are indexed beside the folders as set `hb:<uuid>`, checked by the same code: on every save and
 * again on every load, so a Reload keeps them. Only their owner sees one until it is shared (Owners see all); the
 * engine's sets (`rulesSetOf`) ask no one, so a warband built on a set that was later unshared still loads.
 */
import { hbSetId, isHomebrewSet, uuidOfSet } from '#lib/rules/homebrew';
import type { Element } from '#lib/rules/elements';
import { diff as diffElements } from '#lib/rules/diff';
import { typeOf, type EdgeKind, type IdType } from '#lib/rules/pack';
import type { DiffOut, GraphOut, LinkOut, NodeHead, NodeOut, RuleSetOut } from '#lib/schemas/rules';
import type { RulesSet } from '#lib/rules/pack';
import type { SetWithBase } from '#lib/warbands';
import { AppError } from '../errors';
import { db, type Tx } from '../db';
import * as repo from '../repos/rules';
import * as hbRepo from '../repos/homebrew';
import type { Ctx, SessionUser } from './audit';
import { requireUser } from './auth';

export { indexHomebrew, loadAll, reload, unindexHomebrew } from './rules-load';

/** The neighbourhood graph stops here, so a keyword half the set uses still draws legibly. */
// ponytail: a fixed cap, nearest first; a "show more" control if groups ask for whole hubs.
export const GRAPH_CAP = 60;

export const notLoaded = (id: string) =>
	new AppError('not_found', `No rules set ${id} is loaded. Pick another version.`);

// ---------------------------------------------------------------- reading

/**
 * Every folder, loaded or not, with its report and element counts; with `homebrew`, the homebrew sets too (of any
 * owner: callers filter them).
 */
export async function listSets(homebrew = false): Promise<RuleSetOut[]> {
	const [rows, counts] = await Promise.all([repo.listSets(db()), repo.countsByType(db())]);
	return rows
		.filter((r) => homebrew || !isHomebrewSet(r.id))
		.map((r) => ({
			id: r.id,
			name: r.name,
			kind: r.kind as RuleSetOut['kind'],
			version: r.version,
			base: r.base,
			checksum: r.checksum,
			ok: r.ok,
			loadedAt: r.loadedAt.toISOString(),
			problems: r.report,
			counts: Object.fromEntries(counts.filter((c) => c.setId === r.id).map((c) => [c.type, c.n]))
		}));
}

/**
 * The rules folders for anyone signed in; with `homebrew`, also the homebrew sets they may see (the compendium's
 * version switcher, the builder). The Owner's folder list leaves homebrew out.
 */
export async function sets(ctx: Ctx, homebrew = false): Promise<RuleSetOut[]> {
	const me = requireUser(ctx);
	const all = await listSets(homebrew);
	const seen = await seenHomebrew(
		me,
		all.filter((s) => isHomebrewSet(s.id)).map((s) => s.id)
	);
	return all.filter((s) => !isHomebrewSet(s.id) || seen.has(s.id));
}

/** Which of these homebrew set ids (hb:<uuid>) a person may see: their own and shared ones; Owners see all. */
async function seenHomebrew(me: SessionUser, setIds: string[]) {
	if (me.role === 'owner') return new Set(setIds);
	const ok = await hbRepo.visibleIds(db(), me.id, setIds.map(uuidOfSet));
	return new Set(ok.map(hbSetId));
}

/** A set's chain for this person: a homebrew set in it that they may not see answers like a set not loaded. */
async function seeChain(ctx: Ctx, setId: string) {
	const me = requireUser(ctx);
	const ids = await chain(setId);
	const hb = ids.filter(isHomebrewSet);
	if (hb.length && (await seenHomebrew(me, hb)).size < hb.length) throw notLoaded(setId);
	return ids;
}

/** Refuse (`not_found`) unless the person may see every set named and the homebrew each builds on. */
export async function mayUse(ctx: Ctx, setIds: string[]) {
	for (const id of setIds) await seeChain(ctx, id);
}

/** The set ids to read for `setId`: its base chain, core first. */
export async function chain(setId: string, tx: Tx = db()): Promise<string[]> {
	const rows = new Map((await repo.listSets(tx)).map((r) => [r.id, r]));
	const ids: string[] = [];
	for (let s = rows.get(setId); s; s = s.base ? rows.get(s.base) : undefined) {
		if (!s.ok || ids.includes(s.id)) throw notLoaded(setId);
		ids.unshift(s.id);
	}
	if (!ids.length) throw notLoaded(setId);
	return ids;
}

/** Rows of a chain merged by id, the later set winning. */
const latest = <T extends { id: string; setId: string }>(rows: T[], ids: string[]) =>
	[...rows]
		.sort((a, b) => ids.indexOf(a.setId) - ids.indexOf(b.setId))
		.reduce((m, r) => m.set(r.id, r), new Map<string, T>());

const toElement = (r: repo.RuleNodeRow): Element => ({
	id: r.id,
	type: r.type as IdType,
	name: r.name,
	data: r.data
});

/** The newest loaded core version, where the compendium opens; null when none is loaded. */
export async function defaultSet(ctx: Ctx): Promise<string | null> {
	requireUser(ctx);
	const cores = (await repo.listSets(db())).filter((s) => s.ok && s.kind === 'core');
	cores.sort((a, b) => (b.version ?? '').localeCompare(a.version ?? '', 'en', { numeric: true }));
	return cores[0]?.id ?? null;
}

/** Elements whose name contains `q`, by name (at most `limit`). */
export async function search(
	ctx: Ctx,
	setId: string,
	opts: { q?: string; type?: IdType; limit: number }
): Promise<NodeHead[]> {
	const ids = await seeChain(ctx, setId);
	const rows = await repo.search(db(), ids, opts);
	const keep = latest(rows, ids);
	return rows
		.filter((r) => keep.get(r.id) === r)
		.map((r) => ({ id: r.id, type: r.type as IdType, name: r.name, setId: r.setId }));
}

/**
 * What every compendium page of a set needs: the chain, each element's name and type (link labels), the keywords
 * (pop-ups) and the pages without their bodies (the section tree).
 */
export async function index(ctx: Ctx, setId: string) {
	const ids = await seeChain(ctx, setId);
	const [heads, rows] = await Promise.all([
		repo.heads(db(), ids),
		repo.nodesOfTypes(db(), ids, ['kw', 'page'])
	]);
	const names: Record<string, { name: string; type: IdType }> = {};
	for (const h of latest(heads, ids).values())
		names[h.id] = { name: h.name, type: h.type as IdType };
	const els = [...latest(rows, ids).values()];
	return {
		chain: ids,
		names,
		keywords: Object.fromEntries(
			els
				.filter((e) => e.type === 'kw')
				.map((e) => [e.id, { name: e.name, text: String(e.data.text ?? '') }])
		),
		pages: els
			.filter((e) => e.type === 'page')
			.map((e) => ({
				id: e.id,
				title: e.name,
				section: e.data.section as string,
				order: e.data.order as number,
				parent: (e.data.parent as string | undefined) ?? null
			}))
			.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
	};
}

/** Whole elements of these types (all types when none are given), merged over the chain. */
export async function elements(ctx: Ctx, setId: string, types: IdType[] = []): Promise<Element[]> {
	const ids = await seeChain(ctx, setId);
	return [...latest(await repo.nodesOfTypes(db(), ids, types), ids).values()].map(toElement);
}

/** One element with every link in and out, and its neighbourhood to `depth` (1 or 2) for the graph. */
export async function node(ctx: Ctx, setId: string, id: string, depth = 2): Promise<NodeOut> {
	const ids = await seeChain(ctx, setId);
	const self = latest(await repo.nodesByIds(db(), ids, [id]), ids).get(id);
	if (!self) throw new AppError('not_found', `No element ${id} in ${setId}.`);
	// An element an expansion replaces has its links in both sets: keep one of each.
	const unique = (edges: repo.RuleEdgeRow[]) => [
		...new Map(edges.map((e) => [`${e.fromId} ${e.toId} ${e.kind}`, e])).values()
	];
	const near = unique(await repo.edgesTouching(db(), ids, [id]));
	const depthOf = new Map<string, number>([[id, 0]]);
	const reach = (edges: repo.RuleEdgeRow[], d: number) => {
		for (const e of edges)
			for (const end of [e.fromId, e.toId])
				if (!depthOf.has(end) && depthOf.size < GRAPH_CAP) depthOf.set(end, d);
	};
	reach(near, 1);
	const first = [...depthOf].filter(([, d]) => d === 1).map(([k]) => k);
	const far = depth > 1 ? unique(await repo.edgesTouching(db(), ids, first)) : [];
	reach(far, 2);
	const ends = new Set([...depthOf.keys(), ...near.flatMap((e) => [e.fromId, e.toId])]);
	const heads = latest(await repo.nodesByIds(db(), ids, [...ends]), ids);
	const headOf = (x: string) => ({
		id: x,
		type: (heads.get(x)?.type ?? typeOf(x)) as IdType,
		name: heads.get(x)?.name ?? x
	});
	const link = (kind: string, other: string): LinkOut => ({
		kind: kind as EdgeKind,
		...headOf(other)
	});
	const byName = (a: LinkOut, b: LinkOut) =>
		a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name);
	const graph: GraphOut = {
		nodes: [...depthOf].map(([x, d]) => ({ ...headOf(x), depth: d })),
		links: unique([...near, ...far])
			.filter((e) => depthOf.has(e.fromId) && depthOf.has(e.toId))
			.map((e) => ({ from: e.fromId, to: e.toId, kind: e.kind as EdgeKind }))
	};
	return {
		node: { ...headOf(id), setId: self.setId, data: self.data },
		out: near
			.filter((e) => e.fromId === id)
			.map((e) => link(e.kind, e.toId))
			.sort(byName),
		in: near
			.filter((e) => e.toId === id)
			.map((e) => link(e.kind, e.fromId))
			.sort(byName),
		graph
	};
}

// ---------------------------------------------------------------- sets for the warband engine

/** Built sets by chain, cleared on every load; one group's few versions fit in memory. */
const parsed = new Map<string, Promise<SetWithBase>>();
/** The cache changed: built sets are rebuilt on their next use. */
export const forgetParsed = () => parsed.clear();

/** Where each element type goes in a rules set; skills are read inside their Patron. */
const LISTS: Partial<Record<IdType, Exclude<keyof RulesSet, 'manifest' | 'legalLists'>>> = {
	kw: 'keywords',
	item: 'items',
	line: 'armouryLines',
	faction: 'factions',
	variant: 'variants',
	unit: 'units',
	upgrade: 'upgrades',
	patron: 'patrons',
	table: 'tables',
	scenario: 'scenarios',
	page: 'pages'
};

/**
 * The ids a warband's rules read, in order: the core version's chain, then each expansion with any expansion it
 * builds on (never a second core). Refused with `not_found` when one of them is not loaded.
 */
export async function rulesChain(core: string, expansions: string[] = []): Promise<string[]> {
	const rows = new Map((await repo.listSets(db())).map((r) => [r.id, r]));
	const ids = await chain(core);
	if (rows.get(core)?.kind !== 'core')
		throw new AppError('invalid', `${core} is not a core rules version.`, {
			rulesSet: 'Pick a core version.'
		});
	for (const e of expansions)
		for (const id of await chain(e))
			if (rows.get(id)?.kind !== 'core' && !ids.includes(id)) ids.push(id);
	return ids;
}

/**
 * Check a campaign's rules choice: a loaded core version, and each expansion that is loaded built on it (an
 * expansion not loaded yet is reported where warbands are built, not here).
 */
export async function checkRulesPick(core: string, expansions: string[]) {
	const rows = new Map((await repo.listSets(db())).map((r) => [r.id, r]));
	const c = rows.get(core);
	if (!c?.ok || c.kind !== 'core')
		throw new AppError('invalid', 'Pick a loaded core version.', {
			rulesSet: 'Pick a loaded core version.'
		});
	for (const e of expansions) {
		const r = rows.get(e);
		if (!r?.ok) continue;
		if (!(await chain(e)).includes(core)) {
			const message = `${r.name} ${r.version ?? ''} builds on ${r.base}; pick that version.`;
			throw new AppError('invalid', message, { rulesSet: message });
		}
	}
}

/**
 * A core version with its expansions as one set for the warband engine: each set of the chain rebuilt from its own
 * cached elements, the later ones `base`d on the earlier (the engine merges them, an expansion's element replacing
 * the same id). Cached until the next load.
 */
export function rulesSetOf(core: string, expansions: string[] = []): Promise<SetWithBase> {
	const key = [core, ...expansions].join('+');
	let p = parsed.get(key);
	if (!p) {
		p = buildChain(core, expansions);
		parsed.set(key, p);
		p.catch(() => parsed.delete(key));
	}
	return p;
}

async function buildChain(core: string, expansions: string[]): Promise<SetWithBase> {
	const ids = await rulesChain(core, expansions);
	const [rows, nodes] = await Promise.all([repo.listSets(db()), repo.nodesOfTypes(db(), ids, [])]);
	let out: SetWithBase | undefined;
	for (const id of ids) {
		const r = rows.find((x) => x.id === id)!;
		const set = {
			manifest: {
				id: r.id,
				name: r.name,
				kind: r.kind as RulesSet['manifest']['kind'],
				version: r.version ?? '',
				...(r.base ? { base: r.base } : {})
			},
			keywords: [],
			items: [],
			armouryLines: [],
			factions: [],
			variants: [],
			units: [],
			upgrades: [],
			patrons: [],
			tables: [],
			scenarios: [],
			legalLists: [],
			pages: []
		} as unknown as SetWithBase;
		for (const n of nodes) {
			const list = n.setId === id ? LISTS[n.type as IdType] : undefined;
			if (list) (set[list] as unknown[]).push(n.data);
		}
		if (out) set.base = out;
		out = set;
	}
	return out!;
}

/** The chain of a loaded set, core first (a homebrew set's rules for a new warband). */
export const chainOf = (setId: string) => chain(setId);

/**
 * Check a campaign's homebrew choice against its rules: each set loaded (it passed its check), and built only on
 * the campaign's own versions (a homebrew set on an expansion needs that expansion in the campaign).
 */
export async function checkHomebrewPick(core: string, expansions: string[], uuids: string[]) {
	const plays = [core, ...expansions];
	const want = new Set(await rulesChain(core, expansions).catch(() => plays));
	const rows = new Map((await repo.listSets(db())).map((r) => [r.id, r]));
	for (const uuid of uuids) {
		const name = rows.get(hbSetId(uuid))?.name ?? uuid;
		const ids = await chain(hbSetId(uuid)).catch(() => null);
		const fail = (message: string) => {
			throw new AppError('invalid', message, { homebrewSets: message });
		};
		if (!ids) fail(`${name} has problems in its checks; it can be allowed once they are fixed.`);
		const off = ids!.filter((x) => !isHomebrewSet(x) && !want.has(x));
		if (off.length)
			fail(`${name} builds on ${off.join(' + ')}; this campaign plays ${plays.join(' + ')}.`);
	}
}

/** The homebrew set ids (hb:<uuid>) these allowed sets bring: each with the homebrew it builds on. */
export async function homebrewClosure(uuids: string[]): Promise<Set<string>> {
	const out = new Set<string>();
	for (const uuid of uuids) {
		// An allowed set stays allowed while a draft of it fails its checks (its chain cannot be read then).
		out.add(hbSetId(uuid));
		for (const id of (await chain(hbSetId(uuid)).catch(() => [])).filter(isHomebrewSet))
			out.add(id);
	}
	return out;
}

/** What changed from one version to another, by element id, with each changed field. */
export async function diff(ctx: Ctx, from: string, to: string): Promise<DiffOut> {
	const [a, b] = await Promise.all([elements(ctx, from), elements(ctx, to)]);
	return { from, to, ...diffElements(a, b) };
}
