/** Hell on Earth Weather Events (2D6). */

export type FxPreset =
	| 'quake'
	| 'eclipse'
	| 'wire'
	| 'mud'
	| 'heat'
	| 'clear'
	| 'miasma'
	| 'thin-air'
	| 'smog-storm'
	| 'blood-rain'
	| 'choir';

export interface WeatherEvent {
	roll: number;
	name: string;
	effect: string;
	fx: FxPreset;
}

export const WEATHER: WeatherEvent[] = [
	{ roll: 2, name: 'Traumatised Earth', fx: 'quake', effect: '-1 DICE to Morale Checks (-2 DICE if the Warband is Shaken).' },
	{ roll: 3, name: 'Hemorrhage Eclipse', fx: 'eclipse', effect: 'Injury Rolls from SHRAPNEL attacks place 2 extra BLOOD MARKERS.' },
	{
		roll: 4, name: 'Hungry Barbed Wire', fx: 'wire',
		effect: 'The roll-off winner picks up to D3 terrain pieces (up to 8"×8") that become DANGEROUS: a model ending a move within 3" takes an Injury Roll at -1 DICE.'
	},
	{ roll: 5, name: 'Churning Mud', fx: 'mud', effect: '-1 DICE to Risky rolls for Dash actions.' },
	{ roll: 6, name: 'Oppressive Heat', fx: 'heat', effect: 'Injury Rolls from FIRE attacks place 2 extra BLOOD MARKERS.' },
	{ roll: 7, name: 'Grim and Indifferent', fx: 'clear', effect: 'No effect.' },
	{
		roll: 8, name: 'Graveyard Miasma', fx: 'miasma',
		effect: 'The roll-off winner picks up to D3 terrain pieces that become DIFFICULT; melee attackers in them treat targets as having FEAR.'
	},
	{ roll: 9, name: 'Thin Air', fx: 'thin-air', effect: 'Injury Rolls from GAS attacks place 2 extra BLOOD MARKERS.' },
	{ roll: 10, name: 'Smog Storm', fx: 'smog-storm', effect: 'The Cover / Defended Obstacle modifier becomes -2 DICE.' },
	{ roll: 11, name: 'Raining Blood', fx: 'blood-rain', effect: '+1" to Charge Bonus.' },
	{ roll: 12, name: '(Un)Holy Choir', fx: 'choir', effect: 'Morale Checks pass automatically.' }
];

export function weatherByRoll(roll: number): WeatherEvent | undefined {
	return WEATHER.find((w) => w.roll === roll);
}

export type Rng = () => number;
export const d6 = (rng: Rng = Math.random) => 1 + Math.floor(rng() * 6);

/**
 * Before deployment each player rolls 2D6; the player with the fewest CVP picks which
 * rolled event applies. Returns who chooses (null = tied, roll off).
 */
export function weatherChooser(
	a: { id: string; cvp: number },
	b: { id: string; cvp: number }
): string | null {
	if (a.cvp === b.cvp) return null;
	return a.cvp < b.cvp ? a.id : b.id;
}
