import { weatherByRoll } from '$lib/rules/weather';
import type { Zone } from '$lib/rules/types';
import type { PublicSnapshot } from '$lib/snapshot';
import { DEFAULT_AIR, PRESET_FX, layerParams, type AirKind, type FxKind, type FxParams } from './types';
import { FACTIONS } from '$lib/rules/factions';
import type { Wanted } from './engine';

/**
 * Everything that should be on screen for this snapshot:
 * map-wide ambient layers, regional weather, and each battle's Hell on Earth event.
 */
export function wantedEffects(
	s: PublicSnapshot,
	zones: Map<string, Zone>,
	world: (z: Zone) => { x: number; y: number },
	/** The battle the viewer has entered: its field burns at full intensity. */
	focusZone: string | null = null
): Wanted[] {
	const out = new Map<string, Wanted>();
	// The strongest source of an effect at a place wins (with its tuning).
	const add = (kind: Wanted['kind'], zoneId: string | null, intensity: number, params?: FxParams) => {
		if (!zoneId) {
			const key = `screen:${kind}`;
			const prev = out.get(key);
			if (!prev || prev.intensity < intensity) out.set(key, { key, kind, scope: { type: 'screen' }, intensity, params });
			return;
		}
		const z = zones.get(zoneId);
		if (!z) return;
		const key = `zone:${zoneId}:${kind}`;
		const prev = out.get(key);
		if (!prev || prev.intensity < intensity) {
			const p = world(z);
			out.set(key, { key, kind, scope: { type: 'zone', id: zoneId, x: p.x, y: p.y }, intensity, params });
		}
	};

	for (const [kind, layer] of Object.entries(s.fx.layers)) {
		if (layer?.on) add(kind as FxKind, null, layer.intensity, layerParams(layer));
	}

	// Regional ambient layers: over the region's zones, or the whole map.
	for (const r of s.regions) {
		for (const [kind, layer] of Object.entries(r.layers ?? {})) {
			if (!layer?.on) continue;
			if (r.zones === null) add(kind as FxKind, null, layer.intensity, layerParams(layer));
			else for (const z of r.zones) add(kind as FxKind, z, layer.intensity, layerParams(layer));
		}
	}

	for (const r of s.regions) {
		const ev = r.weatherEvent ? weatherByRoll(r.weatherEvent) : undefined;
		if (!ev) continue;
		for (const kind of PRESET_FX[ev.fx]) {
			if (r.zones === null) add(kind, null, 0.7);
			else for (const z of r.zones) add(kind, z, 0.8);
		}
	}

	// Rudolf's Folly: once anyone holds an Outpost at the airfield, a biplane circles it.
	if (s.warbands.some((w) => w.outposts.includes('rudolfs-folly'))) add('aircraft', 'rudolfs-folly', 0.6);

	// Every battle being fought smokes and flashes; the one being watched most of all.
	for (const g of s.active) if (g.status === 'in_progress') add('battlefield', g.zone, g.zone === focusZone ? 1 : 0.35);

	if (s.fx.battleWeather) {
		for (const g of s.active) {
			const ev = g.weatherEvent ? weatherByRoll(g.weatherEvent) : undefined;
			if (ev) for (const kind of PRESET_FX[ev.fx]) add(kind, g.zone, 1);
		}
	}

	return [...out.values()];
}

/** Particle budget for this device: 0 disables particles entirely. */
export function deviceQuality(cap: 'low' | 'medium' | 'high'): number {
	if (typeof window === 'undefined') return 0;
	if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 0;
	const capQ = { low: 0.35, medium: 0.65, high: 1 }[cap];
	const cores = navigator.hardwareConcurrency ?? 4;
	const small = Math.min(window.innerWidth, window.innerHeight) < 500;
	const device = cores <= 4 || small ? 0.5 : 1;
	return capQ * device;
}

/**
 * What flies over the map, and how often. By hand, the Campaign Master's weights. By the war:
 * - the side ahead in the standings owns more of the sky (heretic hellwings for the Fallen, biplanes for the Faithful);
 * - New Antioch's warbands bring the Papal air arm;
 * - every battle being fought draws more aircraft.
 */
export function airMix(s: PublicSnapshot): { weights: Record<AirKind, number>; everySeconds: number; formations: boolean } {
	const air = s.fx.air ?? DEFAULT_AIR;
	const fighting = s.active.filter((g) => g.status === 'in_progress').length;
	const everySeconds = air.everySeconds / (1 + 0.35 * fighting);
	if (air.mode === 'manual') return { weights: air.weights, everySeconds, formations: air.formations };
	const side = (id: string) => FACTIONS.find((f) => f.id === s.warbands.find((w) => w.id === id)?.faction)?.alignment;
	let faithful = 1;
	let fallen = 1;
	for (const st of s.standings) {
		const a = side(st.id);
		if (a === 'faithful') faithful += 1 + Math.max(0, st.total);
		else if (a === 'fallen') fallen += 1 + Math.max(0, st.total);
	}
	const share = faithful / (faithful + fallen);
	const antioch = s.warbands.filter((w) => w.faction === 'new-antioch').length;
	const faithfulSky = 0.2 + 1.6 * share;
	const papal = faithfulSky * Math.min(0.7, 0.15 + 0.1 * antioch);
	return { weights: { biplane: faithfulSky - papal, papal, hellwing: 0.2 + 1.6 * (1 - share) }, everySeconds, formations: air.formations };
}
