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
	| 'thorns';

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
	thorns: 'Barbed wire'
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
	'quake'
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
}

export const DEFAULT_FX: FxConfig = {
	layers: {},
	wind: 0.2,
	random: { on: false, everySeconds: 45, kinds: ['lightning', 'crows', 'fire'] },
	quality: 'high',
	battleWeather: true
};

export type TriggerKind = 'lightning' | 'crows' | 'fire' | 'quake';

export const TRIGGER_LABELS: Record<TriggerKind, string> = {
	lightning: 'Lightning strike',
	crows: 'Crow flock',
	fire: 'Hellfire burst',
	quake: 'Tremor'
};

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
	kind: TriggerKind | 'dice';
	dice?: DiceRoll;
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
}

export function normaliseFx(raw: unknown): FxConfig {
	const c = (raw ?? {}) as Partial<FxConfig>;
	return {
		...DEFAULT_FX,
		...c,
		layers: { ...(c.layers ?? {}) },
		random: { ...DEFAULT_FX.random, ...(c.random ?? {}) }
	};
}
