import { weatherByRoll } from '$lib/rules/weather';
import type { Zone } from '$lib/rules/types';
import type { PublicSnapshot } from '$lib/snapshot';
import { PRESET_FX, type FxKind } from './types';
import type { Wanted } from './engine';

/**
 * Everything that should be on screen for this snapshot:
 * map-wide ambient layers, regional weather, and each battle's Hell on Earth event.
 */
export function wantedEffects(
	s: PublicSnapshot,
	zones: Map<string, Zone>,
	world: (z: Zone) => { x: number; y: number }
): Wanted[] {
	const out = new Map<string, Wanted>();
	const add = (kind: FxKind, zoneId: string | null, intensity: number) => {
		if (!zoneId) {
			const key = `screen:${kind}`;
			const prev = out.get(key);
			if (!prev || prev.intensity < intensity) out.set(key, { key, kind, scope: { type: 'screen' }, intensity });
			return;
		}
		const z = zones.get(zoneId);
		if (!z) return;
		const key = `zone:${zoneId}:${kind}`;
		const prev = out.get(key);
		if (!prev || prev.intensity < intensity) {
			const p = world(z);
			out.set(key, { key, kind, scope: { type: 'zone', id: zoneId, x: p.x, y: p.y }, intensity });
		}
	};

	for (const [kind, layer] of Object.entries(s.fx.layers)) {
		if (layer?.on) add(kind as FxKind, null, layer.intensity);
	}

	for (const r of s.regions) {
		const ev = r.weatherEvent ? weatherByRoll(r.weatherEvent) : undefined;
		if (!ev) continue;
		for (const kind of PRESET_FX[ev.fx]) {
			if (r.zones === null) add(kind, null, 0.7);
			else for (const z of r.zones) add(kind, z, 0.8);
		}
	}

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
