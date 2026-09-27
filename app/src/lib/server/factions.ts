import { asc } from 'drizzle-orm';
import { db } from './db';
import { customFaction } from './db/schema';
import { registerFactions, type CustomFaction } from '$lib/custom-factions';

export async function customFactions(): Promise<CustomFaction[]> {
	return (await db.select().from(customFaction).orderBy(asc(customFaction.createdAt))).map((f) => ({
		id: f.id,
		name: f.name,
		alignment: f.alignment,
		parent: f.parent,
		description: f.description,
		colours: f.colours ?? null
	}));
}

/** Load the authored factions into the shared faction list (at start, and after every Studio change). */
export async function loadCustomFactions() {
	const list = await customFactions();
	registerFactions(list);
	return list;
}
