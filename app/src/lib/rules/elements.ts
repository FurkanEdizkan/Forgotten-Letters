/**
 * A rules set as a flat list of elements (the graph's nodes): every keyword, item, armoury line, faction, variant,
 * unit, upgrade, Patron, Patron skill, table, scenario and page, each with its id, type, name and data. Legal lists
 * are test data for the warband engine, not elements.
 */
import { typeOf, type IdType, type RulesSet } from './pack';

export interface Element {
	id: string;
	type: IdType;
	name: string;
	data: Record<string, unknown>;
}

/** The file an element of this type comes from (pages come from `pages/*.json`). */
export const FILE_OF: Partial<Record<IdType, string>> = {
	kw: 'keywords.json',
	item: 'items.json',
	line: 'armoury-lines.json',
	faction: 'factions.json',
	variant: 'variants.json',
	unit: 'units.json',
	upgrade: 'upgrades.json',
	patron: 'patrons.json',
	skill: 'patrons.json',
	table: 'tables.json',
	scenario: 'scenarios.json'
};

const el = (data: { id: string; name?: string; title?: string }): Element => ({
	id: data.id,
	type: typeOf(data.id),
	// Armoury lines have no name of their own; the compendium names them by their item.
	name: data.name ?? data.title ?? data.id,
	data: data as Record<string, unknown>
});

export function elementsOf(set: RulesSet): Element[] {
	const out: Element[] = [];
	for (const list of [
		set.keywords,
		set.items,
		set.armouryLines,
		set.factions,
		set.variants,
		set.units,
		set.upgrades,
		set.tables,
		set.scenarios,
		set.pages
	])
		for (const x of list) out.push(el(x));
	for (const p of set.patrons) {
		out.push(el(p));
		for (const s of p.skills) out.push(el({ ...s, patron: p.id } as { id: string; name: string }));
	}
	// A line is named after the item it sells, so search and the graph read "Hook Rifle", not an id.
	const names = new Map(out.map((e) => [e.id, e.name]));
	for (const e of out) if (e.type === 'line') e.name = names.get(e.data.item as string) ?? e.name;
	return out;
}

/** The elements of a chain (core first, then each expansion): a later set's element replaces an earlier one. */
export function mergeElements(chain: Element[][]): Element[] {
	const byId = new Map<string, Element>();
	for (const list of chain) for (const e of list) byId.set(e.id, e);
	return [...byId.values()];
}
