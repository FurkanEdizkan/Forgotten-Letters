import type { CvpSource } from '$lib/rules/engine';
import type { Standing } from '$lib/rules/scoring';
import type { Building, Resource } from '$lib/rules/types';
import type { FxConfig, PublicRegion } from '$lib/fx/types';

/** Shape of the public campaign state sent to players (SSR + live stream). */
export interface PublicWarband {
	id: string;
	name: string;
	player: string;
	seat: number | null;
	portrait: string | null;
	symbol: string | null;
	faction: string;
	variant: string | null;
	patron: string | null;
	entryZone: string;
	/** Zone the warband is shown at: its game in progress, else its last game, else its Entry Zone. */
	position: string;
	playing: boolean;
	games: number;
	wins: number;
	cvp: number;
	cvpBreakdown: Record<CvpSource, number>;
	glory: number[];
	tracks: Record<Resource, number>;
	conquest: number;
	aggression: ('W' | 'L' | 'D')[];
	other: number[];
	dice: number;
	rerolls: number;
	sets: number;
	rollMod: boolean;
	buildings: Record<Building, number>;
	scouted: string[];
	outposts: string[];
	supplied: string[];
	omens: number;
	apocrypha: number;
	/** Only after the reveal. */
	vision: string | null;
	/** Roster bank. */
	treasury: { ducats: number; glory: number };
	/** Active models on the roster. */
	units: PublicUnit[];
}

export interface PublicUnit {
	id: string;
	name: string;
	type: string;
	category: 'elite' | 'troop' | 'mercenary';
	leader: boolean;
	cost: number;
	currency: 'ducats' | 'glory';
	experience: number;
	equipment: { name: string; kind: 'ranged' | 'melee' | 'armour' | 'equipment'; cost: number; currency: 'ducats' | 'glory' }[];
	upgrades: string[];
	skills: string[];
	injuries: string[];
	stats: { movement?: string; ranged?: string; melee?: string; armour?: string; base?: string };
	photo: string | null;
	status: 'active' | 'dead' | 'retired';
}

export interface PublicGame {
	id: string;
	zone: string;
	aggressor: string;
	defender: string;
	scenario: string | null;
	weatherEvent: number | null;
	/** Planned (not started) or being fought. */
	status: 'scheduled' | 'in_progress' | 'done';
	/** Why this side is the Aggressor. */
	aggressorReason: 'fewer' | 'roll-off' | 'chosen' | null;
	/** Hell on Earth 2D6 rolls, once rolled. */
	weatherRolls: { aggressor: [number, number] | null; defender: [number, number] | null; chooser: string | null } | null;
}

export interface PublicSnapshot {
	campaign: { name: string; gamesPerPlayer: number; houseZones: boolean; visionsRevealed: boolean };
	warbands: PublicWarband[];
	active: PublicGame[];
	recent: (PublicGame & { winner: string | null; at: number })[];
	standings: Standing[];
	merchantTier: number;
	omensTaken: string[];
	fx: FxConfig;
	regions: PublicRegion[];
	updatedAt: number;
}
