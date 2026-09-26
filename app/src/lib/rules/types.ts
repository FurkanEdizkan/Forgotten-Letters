export type Resource = 'F' | 'R' | 'S' | 'T';
export const RESOURCES: Resource[] = ['F', 'R', 'S', 'T'];
export const RESOURCE_NAMES: Record<Resource, string> = {
	F: 'Favour',
	R: 'Relics',
	S: 'Supplies',
	T: 'Territories'
};

export type Building = 'shrine' | 'vault' | 'depot' | 'garrison';
export const BUILDING_FOR: Record<Resource, Building> = {
	F: 'shrine',
	R: 'vault',
	S: 'depot',
	T: 'garrison'
};

export type ZoneType = 'entry' | 'basic' | 'special';
export type Archetype = 'no-mans-land' | 'derelict-ruins' | 'trench-lines';

export interface Zone {
	id: string;
	name: string;
	aliases?: string[];
	type: ZoneType;
	resources: Resource[];
	/** Named scenario, or a random archetype. Entry zones have neither. */
	scenario?: string;
	archetype?: Archetype;
	/** Special Zone outpost bonus text. */
	bonus?: string;
	/** First warband to raise an Outpost here gains an Omen of Leviathan. */
	omen?: 'first' | 'each';
	/** Counts as 2 zones for Largest Enclave. */
	enclaveWeight?: number;
	/** House (our campaign) addition rather than printed on the map. */
	house?: boolean;
	links: string[];
	/** Map anchor in normalised [0,1] coordinates of the base map image. */
	pos?: { x: number; y: number };
}

/** Rewards printed under a Campaign Tracker box. */
export type Reward =
	| { t: 'cvp'; n: number }
	| { t: 'die' }
	| { t: 'reroll' }
	| { t: 'set' }
	| { t: 'explore'; table: Resource }
	| { t: 'fill'; track: Resource }
	| { t: 'fillAny' }
	| { t: 'building'; kind: Building; tier: 1 | 2 | 3 };

/**
 * Effects recorded by the Campaign Master: exploration outcomes, Glory→CVP trades,
 * corrections. They are replayed in order to derive state.
 */
export type Effect =
	| { t: 'cvp'; n: number }
	| { t: 'glory'; n: number }
	| { t: 'ducats'; n: number }
	| { t: 'fill'; track: Resource }
	| { t: 'omen'; n: number }
	| { t: 'apocrypha'; n: number }
	| { t: 'die' }
	| { t: 'reroll' }
	| { t: 'set' }
	| { t: 'rollMod' }
	| { t: 'reach2' }
	| { t: 'merchant'; tier: 5 | 8 | 12 }
	| { t: 'building'; kind: Building }
	| { t: 'scout'; zone: string }
	| { t: 'outpost'; zone: string }
	| { t: 'note'; text: string };

export interface Exploration {
	/** The table rolled on; absent for a defender (no table) roll. */
	table?: Resource;
	dice: number[];
	total: number;
	result?: string;
	effects: Effect[];
}

export interface SideResult {
	deeds: number;
	/** Resource boxes marked in the Tracker step (1, or 2 different if Aggressor won). */
	fills: Resource[];
	/** Choices for "+ any Resource" rewards, consumed in the order they trigger. */
	anyChoices?: Resource[];
	/** The Exploration Step roll (Aggressor: table result; defender: Folly check). */
	exploration?: Exploration;
	/** Rolls owed by "Map" rewards, consumed in the order they trigger. */
	bonusExplorations?: Exploration[];
	/** House rule Razing: a winning Aggressor strikes out the defender's Outpost in this zone. */
	raze?: boolean;
}

export interface GameEvent {
	kind: 'game';
	id: string;
	at: number;
	zone: string;
	aggressor: string;
	defender: string;
	/** null = draw. */
	winner: string | null;
	scenario?: string;
	/** Scenario came from the Random generator (Lion Vision counts at most one). */
	scenarioRandom?: boolean;
	weatherEvent?: number;
	sides: Record<string, SideResult>;
}

export interface AdjustmentEvent {
	kind: 'adjustment';
	id: string;
	at: number;
	warband: string;
	effects: Effect[];
	anyChoices?: Resource[];
	bonusExplorations?: Exploration[];
	note?: string;
}

export type CampaignEvent = GameEvent | AdjustmentEvent;

export type GloryScoring = 'boxIndex' | 'deeds' | 'none';

export interface RulesConfig {
	gamesPerPlayer: number;
	gloryScoring: GloryScoring;
	houseZones: boolean;
	outpostLevy: boolean;
	razing: boolean;
}

export const DEFAULT_CONFIG: RulesConfig = {
	gamesPerPlayer: 8,
	gloryScoring: 'boxIndex',
	houseZones: true,
	outpostLevy: false,
	razing: false
};

export interface WarbandInfo {
	id: string;
	entryZone: string;
	/** Vision card id — only present in CM views. */
	vision?: string;
	/** CM-entered achieved level for Visions that can't be computed. */
	visionLevel?: number;
}
