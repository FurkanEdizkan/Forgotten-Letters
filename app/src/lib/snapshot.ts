import type { SealLook } from '$lib/seals';
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
	/** Map marker preference, and the rendered model tokens to use (null: defaults). */
	displayModel: 'portrait' | 'model';
	/** The warband's seal (its own colours or symbol), or null when it has none. */
	seal: SealLook | null;
	outpostToken: string | null;
	figureToken: string | null;
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
	/** The unit's own picture, if any. */
	photo: string | null;
	/** Its type's default picture, set by the Campaign Master. */
	art: string | null;
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
	/** The round of battles it belongs to (null: arranged by hand). */
	roundId: string | null;
	/** Why this side is the Aggressor. */
	aggressorReason: 'fewer' | 'roll-off' | 'chosen' | null;
	/** Hell on Earth 2D6 rolls, once rolled. */
	weatherRolls: { aggressor: [number, number] | null; defender: [number, number] | null; chooser: string | null } | null;
}

/** The round of battles in progress (or the last one): public, since every roll and pick is made in the open. */
export interface PublicRound {
	id: string;
	number: number;
	step: 'rolling' | 'pairing' | 'battles' | 'closed';
	/** In rank order (fewer times Aggressor, then the higher roll). */
	entries: { warbandId: string; aggressions: number; rolls: number[]; role: 'aggressor' | 'defender' | 'bye' | null; pickOrder: number | null }[];
	/** Still to roll, and tied players who must roll again. */
	waiting: string[];
	reroll: string[];
	/** The Aggressor whose turn it is to pick. */
	picker: string | null;
	battles: { id: string; zone: string; aggressor: string; defender: string; status: 'scheduled' | 'in_progress' | 'done' }[];
}

export interface Monument {
	gameId: string;
	zone: string;
	/** Null for a draw: a cairn instead of a monument. */
	winnerFaction: string | null;
	loserFaction: string | null;
	tier: 1 | 2 | 3;
	fallen: number;
	at: number;
}

export interface PublicSnapshot {
	campaign: {
		name: string;
		gamesPerPlayer: number;
		houseZones: boolean;
		visionsRevealed: boolean;
		/** Setup, mustering (players joining), underway (rounds of battles) or ended. */
		stage: 'setup' | 'mustering' | 'underway' | 'ended';
	};
	warbands: PublicWarband[];
	active: PublicGame[];
	recent: (PublicGame & { winner: string | null; at: number })[];
	/** Every finished battle's mark on the map, oldest first. */
	monuments: Monument[];
	standings: Standing[];
	merchantTier: number;
	omensTaken: string[];
	fx: FxConfig;
	regions: PublicRegion[];
	round: PublicRound | null;
	updatedAt: number;
}
