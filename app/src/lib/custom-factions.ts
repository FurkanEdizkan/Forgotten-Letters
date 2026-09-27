/**
 * Factions and variants authored in the Faction Studio join the books' own list at run time, in place, so every
 * module that reads FACTIONS (and the seal and sigil colours) sees them without knowing they are custom.
 */
import { FACTIONS } from './rules/factions';
import { SIGILS } from './sigils';
import { FACTION_METAL } from './seals';

export interface CustomFaction {
	id: string;
	name: string;
	alignment: 'faithful' | 'fallen';
	/** Null for a new faction; else the faction this variant belongs to. */
	parent: string | null;
	description: string | null;
	colours: { metal: string; low: string; high: string } | null;
}

/** What each registration added, so a later call (after edits or deletes) can take it back first. */
let added: { factions: string[]; variants: [string, string][] } = { factions: [], variants: [] };

export function registerFactions(list: CustomFaction[]) {
	// Undo the previous registration, then apply the current list.
	for (const id of added.factions) {
		const i = FACTIONS.findIndex((f) => f.id === id);
		if (i >= 0) FACTIONS.splice(i, 1);
	}
	for (const [parent, name] of added.variants) {
		const p = FACTIONS.find((f) => f.id === parent);
		if (p) p.variants = p.variants.filter((v) => v !== name);
	}
	added = { factions: [], variants: [] };
	for (const f of list.filter((x) => !x.parent)) {
		if (FACTIONS.some((x) => x.id === f.id)) continue;
		FACTIONS.push({ id: f.id, name: f.name, alignment: f.alignment, variants: [] });
		added.factions.push(f.id);
		if (f.colours) {
			SIGILS[f.id] = { low: f.colours.low, high: f.colours.high, rim: f.colours.metal };
			FACTION_METAL[f.id] = f.colours.metal;
		}
	}
	for (const v of list.filter((x) => x.parent)) {
		const p = FACTIONS.find((f) => f.id === v.parent);
		if (!p || p.variants.includes(v.name)) continue;
		p.variants.push(v.name);
		added.variants.push([p.id, v.name]);
	}
}
