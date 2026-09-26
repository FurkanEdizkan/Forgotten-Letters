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
}

export interface PublicGame {
	id: string;
	zone: string;
	aggressor: string;
	defender: string;
	scenario: string | null;
	weatherEvent: number | null;
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
