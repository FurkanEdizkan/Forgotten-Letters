/**
 * The campaign map: its uploaded image and its zones (Admin → Map). Zones live in `map_zone`; a campaign
 * without any is seeded from the Carcass Front preset, so existing campaigns keep their map.
 */
import sharp from 'sharp';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from './db';
import { campaign, game, mapZone, warband } from './db/schema';
import { currentCampaign } from './campaign';
import { publish } from './hub';
import { removeImage, resolveUpload, saveImage } from './uploads';
import { PRESET_ZONES, setZones } from '$lib/rules/zones';
import type { Zone } from '$lib/rules/types';

export interface MapInfo {
	src: string | null;
	width: number;
	height: number;
}

/** The preset's own map measures 1199 × 802; a campaign without an image keeps that shape. */
const DEFAULT_SIZE = { width: 1199, height: 802 };

export async function mapInfo(): Promise<MapInfo> {
	const c = await currentCampaign();
	return c?.mapImage && c.mapWidth && c.mapHeight ? { src: c.mapImage, width: c.mapWidth, height: c.mapHeight } : { src: null, ...DEFAULT_SIZE };
}

async function zonesOf(campaignId: string): Promise<Zone[]> {
	return (await db.select().from(mapZone).where(eq(mapZone.campaignId, campaignId)).orderBy(asc(mapZone.order))).map((r) => r.zone);
}

/** Load the current campaign's zones into the shared list (seeding the preset the first time). */
export async function loadZones(): Promise<Zone[]> {
	const c = await currentCampaign();
	if (!c) return [];
	let zones = await zonesOf(c.id);
	if (!zones.length) {
		await writeZones(c.id, PRESET_ZONES);
		zones = PRESET_ZONES;
	}
	setZones(zones);
	return zones;
}

async function writeZones(campaignId: string, zones: Zone[]) {
	await db.transaction(async (tx) => {
		await tx.delete(mapZone).where(eq(mapZone.campaignId, campaignId));
		if (zones.length) await tx.insert(mapZone).values(zones.map((zone, order) => ({ campaignId, id: zone.id, order, zone })));
	});
}

/** Zone ids that warbands start in or games were fought in: they cannot be removed. */
async function zonesInUse(campaignId: string, ids: string[]) {
	if (!ids.length) return [];
	const starts = await db.select({ z: warband.entryZone }).from(warband).where(and(eq(warband.campaignId, campaignId), inArray(warband.entryZone, ids)));
	const games = await db.select({ z: game.zone }).from(game).where(and(eq(game.campaignId, campaignId), inArray(game.zone, ids)));
	return [...new Set([...starts, ...games].map((r) => r.z).filter((z): z is string => !!z))];
}

/** Replace the map's zones; refuses to drop zones the campaign has used. Returns the ids in use, if any. */
export async function saveZones(zones: Zone[]): Promise<{ inUse: string[] }> {
	const c = await currentCampaign();
	if (!c) throw new Error('No campaign');
	const kept = new Set(zones.map((z) => z.id));
	const dropped = (await zonesOf(c.id)).map((z) => z.id).filter((id) => !kept.has(id));
	const inUse = await zonesInUse(c.id, dropped);
	if (inUse.length) return { inUse };
	await writeZones(c.id, zones);
	await loadZones();
	publish(c.id);
	return { inUse: [] };
}

/** Store a new map image (WebP, at most 4096 px) and remember its size. */
export async function setMapImage(file: FormDataEntryValue | null) {
	const c = await currentCampaign();
	if (!c) throw new Error('No campaign');
	const path = await saveImage(c.id, file, 4096, 'inside', 30 * 1024 * 1024);
	if (!path) throw new Error('Choose an image file.');
	const meta = await sharp(resolveUpload(path)!).metadata();
	await db.update(campaign).set({ mapImage: path, mapWidth: meta.width, mapHeight: meta.height }).where(eq(campaign.id, c.id));
	await removeImage(c.mapImage);
	publish(c.id);
}

export async function clearMapImage() {
	const c = await currentCampaign();
	if (!c) return;
	await db.update(campaign).set({ mapImage: null, mapWidth: null, mapHeight: null }).where(eq(campaign.id, c.id));
	await removeImage(c.mapImage);
	publish(c.id);
}
