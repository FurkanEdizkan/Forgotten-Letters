/**
 * The compendium's views over a chain's elements (core plus expansions, already merged): the Battlekit with who
 * may take each item, a faction with its units, armoury, variants and upgrades, and a variant with what it changes.
 * Pure, so the pages stay thin and the shapes are tested without a database.
 */
import type { Element } from './elements';
import { ITEM_CATEGORIES, type ArmouryLine, type Faction, type Item, type Unit } from './pack';
import type { Upgrade, Variant } from './pack';

export interface Ref {
	id: string;
	name: string;
}

const named = (els: Map<string, Element>, id: string): Ref => ({
	id,
	name: els.get(id)?.name ?? id
});
const of = <T>(els: Element[], type: string) =>
	els.filter((e) => e.type === type).map((e) => e.data as T);
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

export interface KitItem {
	item: Item;
	takenBy: Ref[];
}

/** Every item, by name, with the factions and variants whose armoury sells it. */
export function battlekit(els: Element[]): KitItem[] {
	const map = new Map(els.map((e) => [e.id, e]));
	const takers = new Map<string, Map<string, Ref>>();
	for (const l of of<ArmouryLine>(els, 'line')) {
		const t = takers.get(l.item) ?? new Map<string, Ref>();
		t.set(l.owner, named(map, l.owner));
		takers.set(l.item, t);
	}
	return of<Item>(els, 'item')
		.sort(byName)
		.map((item) => ({ item, takenBy: [...(takers.get(item.id)?.values() ?? [])].sort(byName) }));
}

export interface ArmouryRow {
	line: ArmouryLine;
	item: Item | null;
}

/** An owner's armoury lines grouped by item category, in the format's category order. */
function armoury(els: Element[], owner: string) {
	const items = new Map(of<Item>(els, 'item').map((i) => [i.id, i]));
	const rows = of<ArmouryLine>(els, 'line')
		.filter((l) => l.owner === owner)
		.map((line) => ({ line, item: items.get(line.item) ?? null }));
	return ITEM_CATEGORIES.map((category) => ({
		category,
		rows: rows.filter((r) => r.item?.category === category).sort((a, b) => byName(a.item!, b.item!))
	})).filter((g) => g.rows.length);
}

const unitsOf = (els: Element[], owner: string) =>
	of<Unit>(els, 'unit')
		.filter((u) => u.owner === owner)
		.sort((a, b) => a.category.localeCompare(b.category) || byName(a, b));

const upgradesOf = (els: Element[], owner: string) =>
	of<Upgrade>(els, 'upgrade')
		.filter((u) => u.owner === owner)
		.sort(byName);

/** The factions, by name. */
export const factions = (els: Element[]) => of<Faction>(els, 'faction').sort(byName);

export function factionView(els: Element[], id: string) {
	const map = new Map(els.map((e) => [e.id, e]));
	const faction = map.get(id)?.data as Faction | undefined;
	if (!faction || map.get(id)!.type !== 'faction') return null;
	return {
		faction,
		variants: of<Variant>(els, 'variant')
			.filter((v) => v.faction === id)
			.sort(byName),
		units: unitsOf(els, id),
		armoury: armoury(els, id),
		upgrades: upgradesOf(els, id),
		mercenaries: (faction.mercenaries ?? []).map((m) => named(map, m)),
		patrons: els
			.filter((e) => e.type === 'patron' && (e.data.factions as string[] | undefined)?.includes(id))
			.map((e) => named(map, e.id))
	};
}

export function variantView(els: Element[], id: string) {
	const map = new Map(els.map((e) => [e.id, e]));
	const variant = map.get(id)?.data as Variant | undefined;
	if (!variant || map.get(id)!.type !== 'variant') return null;
	return {
		variant,
		faction: named(map, variant.faction),
		units: unitsOf(els, id),
		armoury: armoury(els, id),
		upgrades: upgradesOf(els, id),
		replaces: (variant.replaces ?? []).map((r) => ({
			from: named(map, r.from),
			to: named(map, r.to)
		})),
		adds: (variant.adds ?? []).map((a) => named(map, a)),
		excludes: (variant.excludes ?? []).map((x) => named(map, x))
	};
}
