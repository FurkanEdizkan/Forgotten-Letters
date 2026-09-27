import { and, eq } from 'drizzle-orm';
import { db } from './db';
import { zoneLore } from './db/schema';
import { LORE_SEED } from '$lib/lore-seed';

export interface Lore {
	lore: string;
	image: string | null;
	/** Where the text came from: written for this campaign, or the Player's Guide default. */
	source: 'campaign' | 'guide' | null;
}

export function loreFor(campaignId: string, zoneId: string): Lore {
	const row = db
		.select()
		.from(zoneLore)
		.where(and(eq(zoneLore.campaignId, campaignId), eq(zoneLore.zoneId, zoneId)))
		.get();
	if (row && (row.lore.trim() || row.image)) return { lore: row.lore, image: row.image, source: 'campaign' };
	const seed = LORE_SEED[zoneId];
	return seed ? { lore: seed, image: null, source: 'guide' } : { lore: '', image: null, source: null };
}

export function allLore(campaignId: string) {
	return new Map(
		db
			.select()
			.from(zoneLore)
			.where(eq(zoneLore.campaignId, campaignId))
			.all()
			.map((r) => [r.zoneId, r])
	);
}

export function saveLore(campaignId: string, zoneId: string, lore: string, image?: string | null) {
	const values = { campaignId, zoneId, lore, updatedAt: new Date(), ...(image !== undefined ? { image } : {}) };
	db.insert(zoneLore)
		.values(values)
		.onConflictDoUpdate({ target: [zoneLore.campaignId, zoneLore.zoneId], set: values })
		.run();
}
