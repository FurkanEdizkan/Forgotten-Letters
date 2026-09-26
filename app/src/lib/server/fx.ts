import { and, eq, isNotNull, gt } from 'drizzle-orm';
import { db } from './db';
import { fxState, regionWeather } from './db/schema';
import { currentCampaign, type Campaign } from './campaign';
import { publish, sendTrigger } from './hub';
import { normaliseFx, type FxConfig, type PublicRegion, type TriggerKind } from '$lib/fx/types';
import { buildGraph } from '$lib/rules/zones';

export function getFx(campaignId: string): FxConfig {
	const row = db.select().from(fxState).where(eq(fxState.campaignId, campaignId)).get();
	return normaliseFx(row?.config);
}

export function saveFx(campaignId: string, config: FxConfig) {
	const clean = normaliseFx(config);
	db.insert(fxState)
		.values({ campaignId, config: clean, updatedAt: new Date() })
		.onConflictDoUpdate({ target: fxState.campaignId, set: { config: clean, updatedAt: new Date() } })
		.run();
	publish(campaignId);
	schedule();
}

export function activeRegions(campaignId: string): PublicRegion[] {
	return db
		.select()
		.from(regionWeather)
		.where(and(eq(regionWeather.campaignId, campaignId), eq(regionWeather.active, true)))
		.all()
		.map((r) => ({
			id: r.id,
			name: r.name,
			zones: (r.zones as string[] | null) ?? null,
			weatherEvent: r.weatherEvent,
			gamesRemaining: r.gamesRemaining
		}));
}

/** The regional weather event covering a zone, if any (zone-specific beats map-wide). */
export function regionEventFor(campaignId: string, zone: string): number | null {
	const regions = activeRegions(campaignId).filter((r) => r.weatherEvent);
	return (
		regions.find((r) => r.zones?.includes(zone))?.weatherEvent ??
		regions.find((r) => r.zones === null)?.weatherEvent ??
		null
	);
}

/** After a game in a zone, count down regions that last a number of games. */
export function tickRegions(campaignId: string, zone: string) {
	const rows = db
		.select()
		.from(regionWeather)
		.where(
			and(
				eq(regionWeather.campaignId, campaignId),
				eq(regionWeather.active, true),
				isNotNull(regionWeather.gamesRemaining),
				gt(regionWeather.gamesRemaining, 0)
			)
		)
		.all();
	for (const r of rows) {
		const zones = r.zones as string[] | null;
		if (zones && !zones.includes(zone)) continue;
		const left = (r.gamesRemaining ?? 1) - 1;
		db.update(regionWeather)
			.set({ gamesRemaining: left, active: left > 0 })
			.where(eq(regionWeather.id, r.id))
			.run();
	}
}

export function trigger(c: Campaign, kind: TriggerKind, zone: string | null) {
	sendTrigger(c.id, { kind, zone, seed: Math.floor(Math.random() * 2 ** 31) });
}

// Random events: one server-side timer so every screen sees the same strike.
let timer: ReturnType<typeof setTimeout> | undefined;

export function schedule() {
	clearTimeout(timer);
	const c = currentCampaign();
	if (!c) return;
	const fx = getFx(c.id);
	if (!fx.random.on || !fx.random.kinds.length) return;
	const every = Math.max(5, fx.random.everySeconds);
	const delay = every * (0.5 + Math.random()) * 1000;
	timer = setTimeout(() => {
		const now = currentCampaign();
		if (now) {
			const cfg = getFx(now.id);
			if (cfg.random.on && cfg.random.kinds.length) {
				const kind = cfg.random.kinds[Math.floor(Math.random() * cfg.random.kinds.length)];
				const zones = [...buildGraph(now.houseZones).zones.keys()];
				// Lightning and fire strike a zone; crows may rise anywhere.
				const zone = kind === 'crows' && Math.random() < 0.5 ? null : zones[Math.floor(Math.random() * zones.length)];
				trigger(now, kind, kind === 'quake' ? null : zone);
			}
		}
		schedule();
	}, delay);
}
