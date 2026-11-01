/**
 * Homebrew sets in the rules folder format: a player's own faction, variant or items, stored as one RulesSet and
 * indexed into the rules cache as set `hb:<uuid>`. Pure, so the editor runs the same checks live in the browser
 * that the server runs on save.
 *
 * Every own element id lives in the set's namespace, `type:hb-<tag>/…` (the manifest id is `hb-<tag>`), so a shared
 * set never replaces an official element or clashes with another homebrew set. A copy of a faction or variant
 * clones its own entries (units, armoury lines, upgrades) under new ids and keeps references to official items and
 * keywords as they are.
 */
import { checkSet, readSet, type Problem } from './check';
import { elementsOf, FILE_OF, type Element } from './elements';
import { typeOf, type ArmouryLine, type IdType, type RulesSet, type Stipulations } from './pack';

export const HOMEBREW_KINDS = ['faction', 'variant', 'items'] as const;
export type HomebrewKind = (typeof HOMEBREW_KINDS)[number];

/** The rules cache id of a homebrew set, and back. */
export const hbSetId = (uuid: string) => `hb:${uuid}`;
export const isHomebrewSet = (setId: string) => setId.startsWith('hb:');
export const uuidOfSet = (setId: string) => setId.slice(3);

/** A fresh namespace tag: eight random hex digits (not the uuid's time-ordered start). */
export function newTag(): string {
	const b = new Uint8Array(4);
	crypto.getRandomValues(b);
	return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Where each list of a RulesSet lives in a rules folder; pages go to one file. */
const FILES_OF: [Exclude<keyof RulesSet, 'manifest'>, string][] = [
	['keywords', 'keywords.json'],
	['items', 'items.json'],
	['armouryLines', 'armoury-lines.json'],
	['factions', 'factions.json'],
	['variants', 'variants.json'],
	['units', 'units.json'],
	['upgrades', 'upgrades.json'],
	['patrons', 'patrons.json'],
	['tables', 'tables.json'],
	['scenarios', 'scenarios.json'],
	['legalLists', 'legal-lists.json'],
	['pages', 'pages/homebrew.json']
];
export const SET_KEYS = ['manifest', ...FILES_OF.map(([k]) => k)] as const;

/** A set as the files of a rules folder (the export shape); empty lists are left out. */
export function filesOf(set: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = { 'manifest.json': set.manifest };
	for (const [key, file] of FILES_OF) {
		const v = set[key];
		if (v !== undefined && !(Array.isArray(v) && !v.length)) out[file] = v;
	}
	return out;
}

/** Files back into a set's shape (unknown files are kept under their name, so the checker reports them). */
export function setOfFiles(files: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = { manifest: files['manifest.json'] };
	const pages: unknown[] = [];
	for (const [file, v] of Object.entries(files)) {
		if (file === 'manifest.json') continue;
		const key = FILES_OF.find(([, f]) => f === file)?.[0];
		if (key && key !== 'pages') out[key] = v;
		else if (/^pages\/[^/]+\.json$/.test(file)) pages.push(...[v].flat());
		else out[file] = v;
	}
	if (pages.length) out.pages = pages;
	return out;
}

const EMPTY = () => ({
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
});

/** The manifest the service keeps on every save: the set's own namespace, name, base and version. */
export const manifestFor = (tag: string, name: string, base: string, version = 1) => ({
	id: `hb-${tag}`,
	name,
	kind: 'homebrew' as const,
	version: String(version),
	base
});

/** The namespace (`hb-<tag>`) of a set's manifest, or '' when it has none. */
export const namespaceOf = (set: { manifest?: unknown }) => {
	const id = (set.manifest as { id?: unknown } | undefined)?.id;
	return typeof id === 'string' ? id : '';
};

export const slug = (name: string) =>
	name
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'x';

/** A new id in the namespace from a name, unique among `taken` (`unit:hb-1a2b3c4d/warden-2`). */
export function newId(type: IdType, ns: string, name: string, taken: ReadonlySet<string>) {
	const base = `${type}:${ns}/${slug(name)}`;
	let id = base;
	for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
	return id;
}

/** Every element id in a set (an unparsed draft counts what it can). */
export const idsOf = (set: RulesSet) => new Set(elementsOf(set).map((e) => e.id));

/** A blank set: a faction with starting values, a variant of `faction`, or nothing yet (items). */
export function blankSet(input: {
	kind: HomebrewKind;
	name: string;
	base: string;
	tag: string;
	faction?: string;
}): RulesSet {
	const ns = `hb-${input.tag}`;
	const set: RulesSet = { manifest: manifestFor(input.tag, input.name, input.base), ...EMPTY() };
	if (input.kind === 'faction')
		set.factions.push({
			id: `faction:${ns}/${slug(input.name)}`,
			name: input.name,
			alignment: 'faithful',
			startDucats: 700,
			startGlory: 0
		});
	if (input.kind === 'variant')
		set.variants.push({
			id: `variant:${ns}/${slug(input.name)}`,
			faction: input.faction!,
			name: input.name
		});
	return set;
}

/**
 * Replace every mapped id in a value: strings equal to an id, `[[id]]` and `[[id|label]]` links in text, and keys
 * (a unit's per-item stipulations are keyed by id). One walk covers owners, leaders, caps, limits, replacements and
 * every other place an id may sit.
 */
export function remap<T>(value: T, map: ReadonlyMap<string, string>): T {
	const text = (s: string) =>
		map.get(s) ??
		s.replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, (all, id: string, label = '') =>
			map.has(id) ? `[[${map.get(id)}${label}]]` : all
		);
	const walk = (v: unknown): unknown =>
		typeof v === 'string'
			? text(v)
			: Array.isArray(v)
				? v.map(walk)
				: v && typeof v === 'object'
					? Object.fromEntries(Object.entries(v).map(([k, x]) => [map.get(k) ?? k, walk(x)]))
					: v;
	return walk(value) as T;
}

/** An id moved into a namespace: `unit:lantern-guild/warden` → `unit:hb-1a2b3c4d/lantern-guild/warden`. */
const into = (id: string, ns: string) => `${typeOf(id)}:${ns}/${id.slice(id.indexOf(':') + 1)}`;

/**
 * A copy of a faction or variant from its base's elements: the faction or variant itself (renamed), and the units,
 * armoury lines and upgrades it owns, under new ids; everything else (items, keywords, Patrons, a variant's
 * faction) stays a reference to the original.
 */
export function copySet(
	elements: Pick<Element, 'id' | 'type' | 'data'>[],
	fromId: string,
	input: { name: string; base: string; tag: string }
): { set: RulesSet; kind: HomebrewKind } {
	const ns = `hb-${input.tag}`;
	const from = elements.find((e) => e.id === fromId);
	if (!from || (from.type !== 'faction' && from.type !== 'variant'))
		throw new Error(`${fromId} is not a faction or variant here.`);
	const owned = elements.filter(
		(e) => ['unit', 'line', 'upgrade'].includes(e.type) && e.data.owner === fromId
	);
	const map = new Map([from, ...owned].map((e) => [e.id, into(e.id, ns)]));
	const clone = <T>(e: { data: Record<string, unknown> }) =>
		remap(structuredClone(e.data), map) as unknown as T;
	const set: RulesSet = { manifest: manifestFor(input.tag, input.name, input.base), ...EMPTY() };
	const head = { ...clone<Record<string, unknown>>(from), name: input.name };
	if (from.type === 'faction') set.factions.push(head as RulesSet['factions'][number]);
	else set.variants.push(head as RulesSet['variants'][number]);
	for (const e of owned) {
		if (e.type === 'unit') set.units.push(clone(e));
		if (e.type === 'line') set.armouryLines.push(clone(e));
		if (e.type === 'upgrade') set.upgrades.push(clone(e));
	}
	return { set, kind: from.type };
}

/** The same set under a new namespace (an import gets its own, so two imports never clash). */
export function renamespace(set: Record<string, unknown>, tag: string, name: string, base: string) {
	const old = namespaceOf(set);
	const ns = `hb-${tag}`;
	const map = new Map<string, string>();
	const add = (x: unknown) => {
		const id = (x as { id?: unknown } | null)?.id;
		if (old && typeof id === 'string' && id.includes(`:${old}/`))
			map.set(id, id.replace(`:${old}/`, `:${ns}/`));
	};
	// Patron skills are elements inside their Patron.
	const walkIds = (v: unknown) => {
		for (const x of Array.isArray(v) ? v : []) {
			add(x);
			const skills = (x as { skills?: unknown } | null)?.skills;
			if (Array.isArray(skills)) skills.forEach(add);
		}
	};
	for (const k of SET_KEYS) if (k !== 'manifest') walkIds(set[k]);
	return { ...remap(set, map), manifest: manifestFor(tag, name, base) };
}

/** A problem for each own element outside the set's namespace, so a homebrew set never replaces another's ids. */
export function namespaceProblems(set: RulesSet): Problem[] {
	const ns = set.manifest.id;
	return elementsOf(set)
		.filter((e) => !e.id.slice(e.id.indexOf(':') + 1).startsWith(`${ns}/`))
		.map((e) => ({
			file: FILE_OF[e.type] ?? 'pages/homebrew.json',
			id: e.id,
			message: `Homebrew ids start with ${e.type}:${ns}/, so they never clash with other sets. Make a new one here.`
		}));
}

/** Check a homebrew set over its base's ids: the rules folder checker, plus the namespace. */
export function checkHomebrew(data: Record<string, unknown>, baseIds: ReadonlySet<string>) {
	const read = readSet(filesOf(data));
	if (!read.set) return { ok: false, problems: read.problems };
	const checked = checkSet(read.set, read.fileOf, baseIds);
	const problems = [...checked.problems, ...namespaceProblems(read.set)];
	return { ok: !problems.length, problems };
}

/** Advice that does not stop the set from loading: a list nobody can equip. */
export function warningsOf(set: RulesSet): string[] {
	const kitless =
		set.units.length > 0 &&
		!set.armouryLines.length &&
		!set.units.some((u) => u.kit.fixed?.length || u.kit.loadouts?.length);
	return kitless
		? ['No unit has any kit: give a unit fixed kit, or add armoury lines it may buy from.']
		: [];
}

/**
 * Whether `unitId` may buy from a line: a line with no "only" units is for everyone. Toggling a unit off a line
 * open to everyone limits it to the other units of `units`; toggling the last one back on opens it again.
 */
export const lineAllows = (line: RulesSet['armouryLines'][number], unitId: string) =>
	!line.stipulations?.only?.units || line.stipulations.only.units.includes(unitId);

export function toggleLine(
	line: RulesSet['armouryLines'][number],
	unitId: string,
	units: string[]
): RulesSet['armouryLines'][number] {
	const { units: listed, ...otherOnly } = line.stipulations?.only ?? {};
	const now = listed ?? units;
	const next = now.includes(unitId) ? now.filter((u) => u !== unitId) : [...now, unitId];
	const everyone = units.every((u) => next.includes(u));
	const only = everyone ? otherOnly : { ...otherOnly, units: next };
	const stipulations: Stipulations = { ...line.stipulations, only };
	if (!Object.keys(only).length) delete stipulations.only;
	const out: ArmouryLine = { ...line, stipulations };
	if (!Object.keys(stipulations).length) delete out.stipulations;
	return out;
}
