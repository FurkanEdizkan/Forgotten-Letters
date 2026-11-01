/**
 * The checker for one rules folder, given its files already read (`{ 'manifest.json': …, 'pages/core.json': … }`).
 * It parses every file with its zod schema, then checks that ids are unique and that every id the set names
 * resolves within the set or its base chain. Each problem names the file, the element id when there is one, and
 * what to fix; a folder with any problem is not loaded.
 */
import { z } from 'zod';
import { elementsOf, FILE_OF, type Element } from './elements';
import { edgesOf, idsIn, target } from './edges';
import {
	FILES,
	manifest,
	page,
	RESERVED_IDS,
	rulesSet,
	typeOf,
	type Edge,
	type RulesSet
} from './pack';

export interface Problem {
	file: string;
	id?: string;
	message: string;
}

/** A folder that passed: its set, its elements (nodes) and its edges. */
export interface Checked {
	set: RulesSet;
	elements: Element[];
	edges: Edge[];
}

/** File name → the key it fills in a RulesSet. */
const KEYS: Record<keyof typeof FILES, keyof RulesSet> = {
	'keywords.json': 'keywords',
	'items.json': 'items',
	'armoury-lines.json': 'armouryLines',
	'factions.json': 'factions',
	'variants.json': 'variants',
	'units.json': 'units',
	'upgrades.json': 'upgrades',
	'patrons.json': 'patrons',
	'tables.json': 'tables',
	'scenarios.json': 'scenarios',
	'legal-lists.json': 'legalLists'
};

/** A pages file holds one page or a list of them. */
const pagesFile = z.union([page, z.array(page)]);

/** The element id at a zod issue's path (`[3, 'keywords', 0]` in items.json → the fourth item's id). */
function idAt(value: unknown, path: PropertyKey[]): string | undefined {
	const i = path[0];
	if (Array.isArray(value) && typeof i === 'number') {
		const id = (value[i] as { id?: unknown } | undefined)?.id;
		return typeof id === 'string' ? id : undefined;
	}
	const id = (value as { id?: unknown } | null)?.id;
	return typeof id === 'string' ? id : undefined;
}

function issues(file: string, value: unknown, error: z.ZodError): Problem[] {
	return error.issues.map((i) => ({
		file,
		...(idAt(value, i.path) ? { id: idAt(value, i.path) } : {}),
		message: `${i.path.length ? `${i.path.join('.')}: ` : ''}${i.message}`
	}));
}

/** Parse every file. Files the format does not know are refused, like unknown keys inside a file. */
export function readSet(files: Record<string, unknown>): {
	set: RulesSet | null;
	fileOf: Map<string, string>;
	problems: Problem[];
} {
	const problems: Problem[] = [];
	const fileOf = new Map<string, string>();
	const raw: Record<string, unknown> = { pages: [] };
	if (!('manifest.json' in files))
		problems.push({ file: 'manifest.json', message: 'Every rules folder needs a manifest.json.' });
	for (const [file, value] of Object.entries(files)) {
		if (file === 'manifest.json') {
			const r = manifest.safeParse(value);
			if (r.success) raw.manifest = r.data;
			else problems.push(...issues(file, value, r.error));
		} else if (file in KEYS) {
			const r = FILES[file as keyof typeof FILES].safeParse(value);
			if (r.success) raw[KEYS[file as keyof typeof FILES]] = r.data;
			else problems.push(...issues(file, value, r.error));
		} else if (/^pages\/[^/]+\.json$/.test(file)) {
			const r = pagesFile.safeParse(value);
			if (!r.success) problems.push(...issues(file, value, r.error));
			else
				for (const p of [r.data].flat()) {
					(raw.pages as unknown[]).push(p);
					fileOf.set(p.id, file);
				}
		} else
			problems.push({
				file,
				message: `Unknown file. A rules folder holds manifest.json, ${Object.keys(FILES).join(', ')} and pages/*.json.`
			});
	}
	if (problems.length) return { set: null, fileOf, problems };
	return { set: rulesSet.parse(raw), fileOf, problems };
}

/**
 * Check a parsed set: unique ids, and every edge target (and every id in a legal list) resolves within the set or
 * `baseIds`, the ids of its base chain.
 */
export function checkSet(
	set: RulesSet,
	fileOf: Map<string, string>,
	baseIds: ReadonlySet<string>
): { checked: Checked | null; problems: Problem[] } {
	const problems: Problem[] = [];
	const elements = elementsOf(set);
	const fileFor = (id: string) => fileOf.get(id) ?? FILE_OF[typeOf(id)] ?? 'pages';
	const ids = new Set<string>();
	for (const e of elements) {
		if (ids.has(e.id))
			problems.push({ file: fileFor(e.id), id: e.id, message: `The id ${e.id} is used twice.` });
		ids.add(e.id);
	}
	const known = (id: string) =>
		ids.has(target(id)) ||
		baseIds.has(target(id)) ||
		(RESERVED_IDS as readonly string[]).includes(id);
	const edges = edgesOf(set);
	// Both ends: a few edges start at the id named (a unit's hiredBy faction hires it, a variant's entry replaces).
	for (const e of edges)
		for (const [end, other] of [
			[e.to, e.from],
			[e.from, e.to]
		] as const)
			if (!known(end))
				problems.push({
					file: fileFor(other),
					id: other,
					message: `${end} does not resolve: no element in this folder or its base has that id.`
				});
	for (const l of set.legalLists)
		for (const id of idsIn(l))
			if (!known(id))
				problems.push({
					file: 'legal-lists.json',
					message: `${l.name}: ${id} does not resolve.`
				});
	return { checked: problems.length ? null : { set, elements, edges }, problems };
}
