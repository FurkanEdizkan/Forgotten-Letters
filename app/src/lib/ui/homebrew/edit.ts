/**
 * Small helpers the homebrew editor's tabs share: number fields that keep an empty box empty (the live checks then
 * say what is missing), the base's lists as select options, and making a new keyword or id in the set's namespace.
 */
import { idsOf, namespaceOf, newId } from '#lib/rules/homebrew';
import type { IdType, RulesSet } from '#lib/rules/pack';

/** What the editor knows of the base rules set, from the page load. */
export interface Base {
	loaded: boolean;
	ids: string[];
	keywords: { id: string; name: string }[];
	items: { id: string; name: string; category: string; type: string }[];
	factions: { id: string; name: string }[];
	units: { id: string; name: string; owner: string }[];
	copiedFrom: string | null;
}

/** A number box's value: empty stays undefined (or null where the format means "none"). */
export const int = (v: unknown) => (v === '' || v == null ? undefined : Number(v));
export const intOrNull = (v: unknown) => (v === '' || v == null ? null : Number(v));

/** A new id of this type in the set's namespace, from a name. */
export const freshId = (set: RulesSet, type: IdType, name: string) =>
	newId(type, namespaceOf(set), name, idsOf(set));

/** Make a keyword of the set's own (a tag with no explanation yet) and return its id. */
export function addKeyword(set: RulesSet, name: string) {
	const id = freshId(set, 'kw', name);
	set.keywords.push({ id, name, kind: 'tag', text: '' });
	return id;
}

/** Keywords to pick from: the base's, then the set's own, by name. */
export const keywordOptions = (set: RulesSet, base: Base) =>
	[...base.keywords, ...set.keywords]
		.map((k) => ({ value: k.id, label: k.name }))
		.sort((a, b) => a.label.localeCompare(b.label));

/** Items to pick from: the base's, then the set's own, by name. */
export const itemOptions = (set: RulesSet, base: Base) =>
	[...base.items, ...set.items]
		.map((i) => ({ value: i.id, label: i.name }))
		.sort((a, b) => a.label.localeCompare(b.label));

/** The owner of the set's own units and lines: its faction or variant (none for a set of items). */
export const ownerOf = (set: RulesSet) => set.factions[0]?.id ?? set.variants[0]?.id ?? null;
