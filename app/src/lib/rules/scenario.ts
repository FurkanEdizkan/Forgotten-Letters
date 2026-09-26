import type { Archetype, Zone } from './types';

export const ARCHETYPE_NAMES: Record<Archetype, string> = {
	'no-mans-land': "No Man's Land",
	'derelict-ruins': 'Derelict Ruins',
	'trench-lines': 'Trench Lines'
};

/** The map's Scenario Generator: D6 → [deployment, victory conditions]. */
const GENERATOR: Record<Archetype, [string, string][]> = {
	'no-mans-land': [
		['Standard Deployment', 'Sabotage'],
		['Tunnels', 'Over the Top'],
		['Long Distance Battle', 'Take and Hold']
	],
	'derelict-ruins': [
		['Flank Attack', 'Attritional Battle'],
		['Fog of War', 'Sabotage'],
		['Chance Encounter', 'Retrieve']
	],
	'trench-lines': [
		['Flank Attack', 'Attritional Battle'],
		['Tunnels', 'Breakthrough'],
		['Long Distance Battle', 'Over the Top']
	]
};

export interface Scenario {
	name: string;
	random: boolean;
	archetype?: Archetype;
	deployment?: string;
	victory?: string;
	turns?: number;
}

export function randomScenario(archetype: Archetype, deployRoll: number, victoryRoll: number, turns: number): Scenario {
	const row = (r: number) => GENERATOR[archetype][Math.floor((r - 1) / 2)];
	const deployment = row(deployRoll)[0];
	const victory = row(victoryRoll)[1];
	return {
		name: `${ARCHETYPE_NAMES[archetype]}: ${deployment} / ${victory}`,
		random: true,
		archetype,
		deployment,
		victory,
		turns
	};
}

export function zoneScenario(zone: Zone): Scenario | undefined {
	if (zone.scenario) return { name: zone.scenario, random: false };
	return undefined;
}
