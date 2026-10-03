/**
 * The starter pack a fresh install begins from (`seed/starter.json`, committed): the zone layout, weather presets,
 * regional weather set-ups and Faction Studio factions of our own. Never the book's map, rules or lore, and never
 * accounts, players or uploads. Download the current one from Admin → Backup to refresh the committed copy.
 */
import { currentEditionId } from './editions';
import { existsSync, readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from './db';
import { customFaction, mapZone, regionWeather, rulesFaction, rulesItem, rulesKeyword, rulesUnit } from './db/schema';
import { getFx, saveFx } from './fx';
import type { Zone } from '$lib/rules/types';
import type { WeatherPreset } from '$lib/fx/types';

type Row = Record<string, unknown>;
export interface Starter {
	app: 'carcass-front-starter';
	version: 1;
	zones: Zone[];
	presets: WeatherPreset[];
	regions: { name: string | null; zones: string[] | null; weatherEvent: number | null; fx: unknown }[];
	studio: { factions: Row[]; units: Row[]; items: Row[]; keywords: Row[]; rules: Row[] };
}

export async function exportStarter(campaignId: string): Promise<Starter> {
	const custom = <T extends { origin: string }>(rows: T[]) => rows.filter((r) => r.origin === 'custom');
	return {
		app: 'carcass-front-starter',
		version: 1,
		zones: (await db.select().from(mapZone).where(eq(mapZone.campaignId, campaignId))).sort((a, b) => a.order - b.order).map((r) => r.zone),
		presets: (await getFx(campaignId)).presets,
		regions: (await db.select().from(regionWeather).where(eq(regionWeather.campaignId, campaignId))).map((r) => ({
			name: r.name,
			zones: r.zones,
			weatherEvent: r.weatherEvent,
			fx: r.fx
		})),
		// Authored work only: book rows, and book rows edited as house rules, carry the books' text.
		// The current edition's authored rows, without their edition (a starter pack seeds whatever edition is current).
		studio: await (async () => {
			const ed = await currentEditionId();
			const strip = <T extends { edition: string }>({ edition: _e, ...r }: T) => r;
			return {
				factions: await db.select().from(customFaction),
				units: custom(await db.select().from(rulesUnit).where(eq(rulesUnit.edition, ed))).map(({ bookCopy: _b, ...r }) => strip(r)),
				items: custom(await db.select().from(rulesItem).where(eq(rulesItem.edition, ed))).map(({ bookCopy: _b, ...r }) => strip(r)),
				keywords: custom(await db.select().from(rulesKeyword).where(eq(rulesKeyword.edition, ed))).map(strip),
				rules: custom(await db.select().from(rulesFaction).where(eq(rulesFaction.edition, ed))).map(strip)
			};
		})()
	};
}

let cached: Starter | null | undefined;
/** The committed starter pack, if the install has one. */
export function starter(): Starter | null {
	if (cached !== undefined) return cached;
	const path = env.STARTER_FILE ?? 'seed/starter.json';
	try {
		const s = existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as Starter) : null;
		cached = s?.app === 'carcass-front-starter' ? s : null;
	} catch (e) {
		console.warn(`Starter pack at ${path} could not be read`, e);
		cached = null;
	}
	return cached;
}

/** A new campaign: its weather presets and (switched off) regional weather from the starter pack. */
export async function applyStarter(campaignId: string) {
	const s = starter();
	if (!s) return;
	const fx = await getFx(campaignId);
	const have = new Set(fx.presets.map((p) => p.name));
	await saveFx(campaignId, { ...fx, presets: [...fx.presets, ...s.presets.filter((p) => !have.has(p.name))] });
	for (const r of s.regions) await db.insert(regionWeather).values({ campaignId, name: r.name, zones: r.zones, weatherEvent: r.weatherEvent, fx: r.fx, active: false });
}

/** First start: the starter pack's own factions join the Faction Studio (existing rows are left alone). */
export async function seedStudio() {
	const s = starter();
	if (!s?.studio.factions.length) return;
	if ((await db.select({ id: customFaction.id }).from(customFaction).limit(1)).length) return;
	// A starter pack's rows (made before editions, or for another install) go into the current edition.
	const edition = await currentEditionId();
	const into = <T>(r: unknown) => ({ ...(r as object), edition }) as T;
	await db.transaction(async (tx) => {
		for (const r of s.studio.factions) await tx.insert(customFaction).values({ ...(r as typeof customFaction.$inferInsert), createdAt: new Date() }).onConflictDoNothing();
		for (const r of s.studio.units) await tx.insert(rulesUnit).values(into<typeof rulesUnit.$inferInsert>(r)).onConflictDoNothing();
		for (const r of s.studio.items) await tx.insert(rulesItem).values(into<typeof rulesItem.$inferInsert>(r)).onConflictDoNothing();
		for (const r of s.studio.keywords) await tx.insert(rulesKeyword).values(into<typeof rulesKeyword.$inferInsert>(r)).onConflictDoNothing();
		for (const r of s.studio.rules) await tx.insert(rulesFaction).values(into<typeof rulesFaction.$inferInsert>(r)).onConflictDoNothing();
	});
}
