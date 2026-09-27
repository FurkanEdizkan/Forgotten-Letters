import { and, eq } from 'drizzle-orm';
import { db } from './db';
import { unitArt } from './db/schema';
import { removeImage } from './uploads';
import { unitTypeKey } from '$lib/unit-art';

export async function listArt(campaignId: string) {
	return db.select().from(unitArt).where(eq(unitArt.campaignId, campaignId));
}

/** `faction:typeKey` → image, for resolving a unit's default picture. */
export async function artIndex(campaignId: string) {
	return new Map((await listArt(campaignId)).map((a) => [`${a.faction}:${a.typeKey}`, a.image]));
}

export const artFor = (index: Map<string, string>, faction: string, type: string) =>
	type ? (index.get(`${faction}:${unitTypeKey(type)}`) ?? null) : null;

export async function setArt(campaignId: string, faction: string, type: string, image: string) {
	const typeKey = unitTypeKey(type);
	const [prev] = await db
		.select()
		.from(unitArt)
		.where(and(eq(unitArt.campaignId, campaignId), eq(unitArt.faction, faction), eq(unitArt.typeKey, typeKey)));
	await db
		.insert(unitArt)
		.values({ campaignId, faction, typeKey, type, image })
		.onConflictDoUpdate({ target: [unitArt.campaignId, unitArt.faction, unitArt.typeKey], set: { image, type, updatedAt: new Date() } });
	if (prev && prev.image !== image) await removeImage(prev.image);
}

export async function removeArt(campaignId: string, faction: string, typeKey: string) {
	const where = and(eq(unitArt.campaignId, campaignId), eq(unitArt.faction, faction), eq(unitArt.typeKey, typeKey));
	const [prev] = await db.select().from(unitArt).where(where);
	await db.delete(unitArt).where(where);
	await removeImage(prev?.image);
}
