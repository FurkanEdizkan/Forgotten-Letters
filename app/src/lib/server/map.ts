/**
 * The campaign map: its uploaded image and its zones (Admin → Map). Zones live in `map_zone`; a campaign
 * without any is seeded from the Carcass Front preset, so existing campaigns keep their map.
 */
import sharp from 'sharp';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from './db';
import { campaign, game, mapZone, warband } from './db/schema';
import { currentCampaign } from './campaign';
import { publish, announceReload } from './hub';
import { removeImage, resolveUpload, saveImage } from './uploads';
import { PRESET_ZONES, setZones } from '$lib/rules/zones';
import { MIN_SCORE, darkness, fitRing } from '$lib/zone-rings';
import { starter } from './starter';
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
		// A new campaign starts from the starter pack's layout, else the Carcass Front preset.
		zones = starter()?.zones.length ? starter()!.zones : PRESET_ZONES;
		await writeZones(c.id, zones);
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
	announceReload('zones');
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
	// A new image: its zones' circles are found afresh.
	await fitZoneRings({ all: true });
	publish(c.id);
}

export async function clearMapImage() {
	const c = await currentCampaign();
	if (!c) return;
	await db.update(campaign).set({ mapImage: null, mapWidth: null, mapHeight: null }).where(eq(campaign.id, c.id));
	await removeImage(c.mapImage);
	publish(c.id);
}

/**
 * Fit each printed zone's circle on the map image (see `fitRing`), so markers and battles stand on the zone as the
 * book drew it. `all`: refit every zone (a new image); otherwise only zones without a circle yet. Drawn (house) zones
 * are the app's own and keep their pins. Returns how many zones were fitted.
 */
export async function fitZoneRings({ all = false } = {}): Promise<number> {
	const c = await currentCampaign();
	const file = c?.mapImage ? resolveUpload(c.mapImage) : null;
	if (!c || !file) return 0;
	const zones = await zonesOf(c.id);
	const todo = zones.filter((z) => !z.house && z.pos && (all || !z.ring));
	if (!todo.length) return 0;
	// Half the book's resolution, softened a little so the coarse search can't step over a printed line.
	const { data, info } = await sharp(file).resize({ width: 1199, withoutEnlargement: true }).greyscale().blur(1.6).raw().toBuffer({ resolveWithObject: true });
	const g = darkness(data, info.width, info.height);
	let fitted = 0;
	const next = zones.map((z) => {
		if (!todo.includes(z)) return z;
		const ring = fitRing(g, z.pos!.x * g.width, z.pos!.y * g.height);
		if (ring.score < MIN_SCORE) {
			const { ring: _, ...rest } = z;
			return rest;
		}
		fitted++;
		const round = (n: number) => Math.round(n * 10000) / 10000;
		return { ...z, ring: { x: round(ring.x / g.width), y: round(ring.y / g.height), r: round(ring.r / g.width) } };
	});
	await writeZones(c.id, next);
	await loadZones();
	announceReload('zones');
	publish(c.id);
	return fitted;
}
