import { and, eq, isNotNull, gt, inArray } from 'drizzle-orm';
import { db } from './db';
import { fxState, game, regionWeather, warband } from './db/schema';
import { currentCampaign, type Campaign } from './campaign';
import { publish, sendTrigger } from './hub';
import { normaliseFx, normaliseLayers, type FxConfig, type PublicRegion, type TriggerKind, type ZeppelinEvent, type BattleResultEvent } from '$lib/fx/types';
import { outcome } from '$lib/battle-outcome';
import type { SideResult } from '$lib/rules/types';
import { buildGraph } from '$lib/rules/zones';

export async function getFx(campaignId: string): Promise<FxConfig> {
	const row = (await db.select().from(fxState).where(eq(fxState.campaignId, campaignId)))[0];
	return normaliseFx(row?.config);
}

export async function saveFx(campaignId: string, config: FxConfig) {
	const clean = normaliseFx(config);
	(await db.insert(fxState)
		.values({ campaignId, config: clean, updatedAt: new Date() })
		.onConflictDoUpdate({ target: fxState.campaignId, set: { config: clean, updatedAt: new Date() } })
		);
	publish(campaignId);
	await schedule();
}

export async function activeRegions(campaignId: string): Promise<PublicRegion[]> {
	return (await db
		.select()
		.from(regionWeather)
		.where(and(eq(regionWeather.campaignId, campaignId), eq(regionWeather.active, true)))
		)
		.map((r) => ({
			id: r.id,
			name: r.name,
			zones: (r.zones as string[] | null) ?? null,
			weatherEvent: r.weatherEvent,
			gamesRemaining: r.gamesRemaining,
			layers: normaliseLayers(r.fx)
		}));
}

/** The regional weather event covering a zone, if any (zone-specific beats map-wide). */
export async function regionEventFor(campaignId: string, zone: string): Promise<number | null> {
	const regions = (await activeRegions(campaignId)).filter((r) => r.weatherEvent);
	return (
		regions.find((r) => r.zones?.includes(zone))?.weatherEvent ??
		regions.find((r) => r.zones === null)?.weatherEvent ??
		null
	);
}

/** After a game in a zone, count down regions that last a number of games. */
export async function tickRegions(campaignId: string, zone: string) {
	const rows = (await db
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
		);
	for (const r of rows) {
		const zones = r.zones as string[] | null;
		if (zones && !zones.includes(zone)) continue;
		const left = (r.gamesRemaining ?? 1) - 1;
		(await db.update(regionWeather)
			.set({ gamesRemaining: left, active: left > 0 })
			.where(eq(regionWeather.id, r.id))
			);
	}
}

export function trigger(c: Campaign, kind: TriggerKind, zone: string | null) {
	sendTrigger(c.id, { kind, zone, seed: Math.floor(Math.random() * 2 ** 31) });
}

/** A finished battle as the result animation needs it (names, factions, how it went). */
export async function battleResult(c: Campaign, gameId: string): Promise<BattleResultEvent | null> {
	const [g] = await db.select().from(game).where(and(eq(game.id, gameId), eq(game.campaignId, c.id)));
	if (!g || g.status !== 'done') return null;
	const sides = await db.select({ id: warband.id, name: warband.name, faction: warband.faction }).from(warband).where(inArray(warband.id, [g.aggressorId, g.defenderId]));
	const side = (id: string) => sides.find((s) => s.id === id) ?? { id, name: 'A warband', faction: '' };
	return {
		gameId: g.id,
		zoneName: buildGraph(c.houseZones).zones.get(g.zone)?.name ?? g.zone,
		aggressor: side(g.aggressorId),
		defender: side(g.defenderId),
		outcome: outcome({ ...g, result: g.result as { sides: Record<string, SideResult> } | null })
	};
}

/** Play a battle's result on every open map. */
export async function announceResult(c: Campaign, gameId: string) {
	const battle = await battleResult(c, gameId);
	const [g] = await db.select({ zone: game.zone }).from(game).where(eq(game.id, gameId));
	if (battle && g) sendTrigger(c.id, { kind: 'battle-result', zone: g.zone, seed: Math.floor(Math.random() * 2 ** 31), battle });
}

/** A zeppelin crosses every map, with the Campaign Master's banner text. */
export function zeppelinEvent(c: Campaign, ev: ZeppelinEvent) {
	sendTrigger(c.id, { kind: 'zeppelin', zone: ev.via, seed: Math.floor(Math.random() * 2 ** 31), zeppelin: ev });
}

// Random events: one server-side timer so every screen sees the same strike.
let timer: ReturnType<typeof setTimeout> | undefined;

export async function schedule() {
	clearTimeout(timer);
	const c = await currentCampaign();
	if (!c) return;
	const fx = await getFx(c.id);
	if (!fx.random.on || !fx.random.kinds.length) return;
	const every = Math.max(5, fx.random.everySeconds);
	const delay = every * (0.5 + Math.random()) * 1000;
	timer = setTimeout(async () => {
		const now = await currentCampaign();
		if (now) {
			const cfg = await getFx(now.id);
			if (cfg.random.on && cfg.random.kinds.length) {
				const kind = cfg.random.kinds[Math.floor(Math.random() * cfg.random.kinds.length)];
				const zones = [...buildGraph(now.houseZones).zones.keys()];
				// Lightning, fire, strafing and bombs strike a zone; crows and flyovers may be anywhere.
				const anywhere = kind === 'quake' || kind === 'flyover' || (kind === 'crows' && Math.random() < 0.5);
				trigger(now, kind, anywhere ? null : zones[Math.floor(Math.random() * zones.length)]);
			}
		}
		await schedule();
	}, delay);
}
