import type { FxPreset } from '$lib/rules/weather';

/** Visual effect kinds the map can render, map-wide or around a zone. */
export type FxKind =
	| 'rain'
	| 'bloodRain'
	| 'storm'
	| 'emeraldStorm'
	| 'fog'
	| 'miasma'
	| 'smog'
	| 'haze'
	| 'dust'
	| 'embers'
	| 'crows'
	| 'eclipse'
	| 'heat'
	| 'choir'
	| 'quake'
	| 'thorns'
	| 'aircraft';

export const FX_LABELS: Record<FxKind, string> = {
	rain: 'Rain',
	bloodRain: 'Blood rain',
	storm: 'Storm & lightning',
	emeraldStorm: 'Emerald lightning',
	fog: 'Fog',
	miasma: 'Graveyard miasma',
	smog: 'Smog & ash',
	haze: 'Thin haze',
	dust: 'Mud & dust',
	embers: 'Hellfire embers',
	crows: 'Crows',
	eclipse: 'Blood eclipse',
	heat: 'Oppressive heat',
	choir: 'Holy light',
	quake: 'Tremors',
	thorns: 'Barbed wire',
	aircraft: 'Aircraft flyovers'
};

/** Ambient kinds offered in the Campaign Master's console. */
export const AMBIENT_KINDS: FxKind[] = [
	'rain',
	'storm',
	'bloodRain',
	'fog',
	'miasma',
	'smog',
	'embers',
	'crows',
	'eclipse',
	'heat',
	'choir',
	'quake',
	'aircraft'
];

/** Hell on Earth event → what it looks like. */
export const PRESET_FX: Record<FxPreset, FxKind[]> = {
	quake: ['quake', 'dust'],
	eclipse: ['eclipse'],
	wire: ['thorns'],
	mud: ['dust', 'rain'],
	heat: ['heat'],
	clear: [],
	miasma: ['miasma'],
	'thin-air': ['haze'],
	'smog-storm': ['smog', 'emeraldStorm'],
	'blood-rain': ['bloodRain'],
	choir: ['choir']
};

export interface FxLayer {
	on: boolean;
	/** 0–1 */
	intensity: number;
	/** Animation speed multiplier (lightning frequency for storms). 0.25–3 */
	speed?: number;
	/** Size multiplier (particles, fog banks, flocks). 0.5–2.5 */
	scale?: number;
	/** 0–1 */
	opacity?: number;
	/** Colour override, '#rrggbb'. */
	tint?: string | null;
}

/** Resolved per-effect parameters the engine applies. */
export interface FxParams {
	speed: number;
	scale: number;
	opacity: number;
	tint: number | null;
}

export const DEFAULT_PARAMS: FxParams = { speed: 1, scale: 1, opacity: 1, tint: null };

export function layerParams(l: FxLayer | undefined): FxParams {
	const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
	const tint = typeof l?.tint === 'string' && /^#[0-9a-f]{6}$/i.test(l.tint) ? parseInt(l.tint.slice(1), 16) : null;
	return {
		speed: clamp(l?.speed, 0.25, 3, 1),
		scale: clamp(l?.scale, 0.5, 2.5, 1),
		opacity: clamp(l?.opacity, 0, 1, 1),
		tint
	};
}

export type TimeOfDay = 'day' | 'dusk' | 'night' | 'blood-moon';
export const TIME_OF_DAY: Record<TimeOfDay, { label: string; color: number; alpha: number }> = {
	day: { label: 'Day', color: 0x000000, alpha: 0 },
	dusk: { label: 'Dusk', color: 0x8a3b12, alpha: 0.22 },
	night: { label: 'Night', color: 0x0b1330, alpha: 0.48 },
	'blood-moon': { label: 'Blood moon', color: 0x5a0606, alpha: 0.4 }
};

export interface WeatherPreset {
	name: string;
	layers: Partial<Record<FxKind, FxLayer>>;
	wind: number;
	timeOfDay: TimeOfDay;
}

export interface FxConfig {
	layers: Partial<Record<FxKind, FxLayer>>;
	/** -1 (blowing west) … 1 (blowing east) */
	wind: number;
	/** Random lightning, crow flocks and hellfire bursts across the map. */
	random: { on: boolean; everySeconds: number; kinds: TriggerKind[] };
	/** Upper bound for every viewer; each device may lower it further. */
	quality: 'low' | 'medium' | 'high';
	/** Show Hell on Earth effects around zones with games in progress. */
	battleWeather: boolean;
	timeOfDay: TimeOfDay;
	presets: WeatherPreset[];
}

export const DEFAULT_FX: FxConfig = {
	layers: {},
	wind: 0.2,
	random: { on: false, everySeconds: 45, kinds: ['lightning', 'crows', 'fire'] },
	quality: 'high',
	battleWeather: true,
	timeOfDay: 'day',
	presets: []
};

export type TriggerKind = 'lightning' | 'crows' | 'fire' | 'quake' | 'flyover' | 'strafing' | 'bombardment';

export const TRIGGER_LABELS: Record<TriggerKind, string> = {
	lightning: 'Lightning strike',
	crows: 'Crow flock',
	fire: 'Hellfire burst',
	quake: 'Tremor',
	flyover: 'Biplane flyover',
	strafing: 'Strafing run',
	bombardment: 'Aerial bombardment'
};

/** A zeppelin crossing the whole map: a special event with its own banner text. */
export interface ZeppelinEvent {
	text: string;
	/** Zone the route passes over (and may bomb); null = a random crossing. */
	via: string | null;
	/** Seconds to cross. */
	seconds: number;
	bomb: boolean;
}

/** Hell on Earth dice rolled for a battle, animated over its zone on every map. */
export interface DiceRoll {
	gameId: string;
	aggressor: { id: string; name: string; dice: [number, number] };
	defender: { id: string; name: string; dice: [number, number] };
	/** Who picks which roll applies (fewest CVP); null = tied, roll off. */
	chooser: string | null;
}

/** One-shot effect pushed to every viewer at once. */
export interface FxTrigger {
	kind: TriggerKind | 'dice' | 'zeppelin';
	dice?: DiceRoll;
	zeppelin?: ZeppelinEvent;
	/** Zone to strike; null = anywhere. */
	zone: string | null;
	/** Deterministic seed so every screen plays the same thing. */
	seed: number;
}

export interface PublicRegion {
	id: string;
	name: string | null;
	/** null = the whole map */
	zones: string[] | null;
	weatherEvent: number | null;
	gamesRemaining: number | null;
	/** Ambient layers scoped to this region, on top of its Hell on Earth event. */
	layers: Partial<Record<FxKind, FxLayer>>;
}

const KINDS = new Set<string>(Object.keys(FX_LABELS));

export function normaliseLayers(raw: unknown): Partial<Record<FxKind, FxLayer>> {
	const out: Partial<Record<FxKind, FxLayer>> = {};
	for (const [k, v] of Object.entries((raw ?? {}) as Record<string, Partial<FxLayer>>)) {
		if (!KINDS.has(k) || !v || typeof v !== 'object') continue;
		const p = layerParams(v as FxLayer);
		out[k as FxKind] = {
			on: !!v.on,
			intensity: typeof v.intensity === 'number' ? Math.min(1, Math.max(0, v.intensity)) : 0.6,
			speed: p.speed,
			scale: p.scale,
			opacity: p.opacity,
			tint: p.tint === null ? null : `#${p.tint.toString(16).padStart(6, '0')}`
		};
	}
	return out;
}

/** Fill defaults and upgrade older configs (v1 layers had only on/intensity). */
export function normaliseFx(raw: unknown): FxConfig {
	const c = (raw ?? {}) as Partial<FxConfig>;
	const tod = c.timeOfDay && c.timeOfDay in TIME_OF_DAY ? c.timeOfDay : 'day';
	return {
		...DEFAULT_FX,
		...c,
		layers: normaliseLayers(c.layers),
		random: { ...DEFAULT_FX.random, ...(c.random ?? {}) },
		timeOfDay: tod,
		presets: (Array.isArray(c.presets) ? c.presets : [])
			.filter((p) => p && typeof p.name === 'string' && p.name.trim())
			.slice(0, 40)
			.map((p) => ({
				name: p.name.trim().slice(0, 60),
				layers: normaliseLayers(p.layers),
				wind: typeof p.wind === 'number' ? Math.max(-1, Math.min(1, p.wind)) : 0.2,
				timeOfDay: p.timeOfDay && p.timeOfDay in TIME_OF_DAY ? p.timeOfDay : 'day'
			}))
	};
}
