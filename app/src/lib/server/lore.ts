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

export async function loreFor(campaignId: string, zoneId: string): Promise<Lore> {
	const row = (await db
		.select()
		.from(zoneLore)
		.where(and(eq(zoneLore.campaignId, campaignId), eq(zoneLore.zoneId, zoneId)))
		)[0];
	if (row && (row.lore.trim() || row.image)) return { lore: row.lore, image: row.image, source: 'campaign' };
	const seed = LORE_SEED[zoneId];
	return seed ? { lore: seed, image: null, source: 'guide' } : { lore: '', image: null, source: null };
}

export async function allLore(campaignId: string) {
	return new Map(
		(await db
			.select()
			.from(zoneLore)
			.where(eq(zoneLore.campaignId, campaignId))
			)
			.map((r) => [r.zoneId, r])
	);
}

export async function saveLore(campaignId: string, zoneId: string, lore: string, image?: string | null) {
	const values = { campaignId, zoneId, lore, updatedAt: new Date(), ...(image !== undefined ? { image } : {}) };
	(await db.insert(zoneLore)
		.values(values)
		.onConflictDoUpdate({ target: [zoneLore.campaignId, zoneLore.zoneId], set: values })
		);
}
