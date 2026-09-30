import { weatherByRoll } from '$lib/rules/weather';
import type { Zone } from '$lib/rules/types';
import type { PublicSnapshot } from '$lib/snapshot';
import { PRESET_FX, layerParams, type FxKind, type FxParams } from './types';
import type { Wanted } from './engine';
import { battlePlacement } from '$lib/map-battles';

/**
 * Everything that should be on screen for this snapshot:
 * map-wide ambient layers, regional weather, and each battle's Hell on Earth event.
 */
export function wantedEffects(
	s: PublicSnapshot,
	zones: Map<string, Zone>,
	world: (z: Zone) => { x: number; y: number },
	/** The battle the viewer has entered: its field burns at full intensity. */
	focusGame: string | null = null
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

	// Battles are placed one by one: several on a zone fan out round it (map-battles.ts), and each carries its own
	// smoke and its own Hell on Earth there, so two battles in one zone show two different skies.
	const spots = battlePlacement(s.active, (id) => {
		const z = zones.get(id);
		return z ? world(z) : null;
	});
	const addBattle = (gameId: string, zoneId: string, kind: Wanted['kind'], intensity: number) => {
		const p = spots.get(gameId);
		if (!p) return;
		const key = `battle:${gameId}:${kind}`;
		out.set(key, { key, kind, scope: { type: 'zone', id: zoneId, x: p.x, y: p.y }, intensity });
	};

	// Every battle being fought smokes and flashes; the one being watched most of all.
	for (const g of s.active) if (g.status === 'in_progress') addBattle(g.id, g.zone, 'battlefield', g.id === focusGame ? 1 : 0.35);

	if (s.fx.battleWeather) {
		for (const g of s.active) {
			const ev = g.weatherEvent ? weatherByRoll(g.weatherEvent) : undefined;
			if (ev) for (const kind of PRESET_FX[ev.fx]) addBattle(g.id, g.zone, kind, 1);
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
