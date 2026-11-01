/** Small builders for the specs: a warband state and fighters, with roomy banks unless a spec says otherwise. */
import type { Fighter, WarbandState } from '../types.ts';

let n = 0;
export function fighter(unitId: string, over: Partial<Fighter> = {}): Fighter {
	const group = /mercenaries\//.test(unitId) ? 'mercenary' : 'troop';
	return {
		id: `f${++n}`,
		unitId,
		group,
		kit: [],
		upgrades: [],
		skills: [],
		injuries: [],
		xp: 0,
		...over
	};
}

export const elite = (unitId: string, over: Partial<Fighter> = {}) =>
	fighter(unitId, { group: 'elite', ...over });

export function wb(fighters: Fighter[], over: Partial<WarbandState> = {}): WarbandState {
	return {
		setId: 'test-core',
		factionId: 'faction:order',
		ducatLimit: 10_000,
		stashDucats: 10_000,
		unspentGlory: 100,
		fighters,
		stash: [],
		fireteams: [],
		locations: [],
		...over
	};
}
