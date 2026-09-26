import { BUILDING_FOR, type Resource, type Reward } from './types';

/**
 * Campaign Tracker box layouts, read from the printed sheet. Index 0 is the
 * double-outlined first box; boxes are filled in this order.
 */

const cvp = (n: number): Reward => ({ t: 'cvp', n });
const any: Reward = { t: 'fillAny' };
const die: Reward = { t: 'die' };

/** Glory: box n scores n CVP (campaign setting `gloryScoring`); extra rewards below. */
export const GLORY_EXTRAS: Reward[][] = [[], [], [any], [], [die], [any], [], [], [die], [any], [], []];
export const GLORY_BOXES = GLORY_EXTRAS.length;

/** Resource tracks: 15 boxes in 3 serpentine rows of 5. */
const CROSS: Record<Resource, [Resource, Resource]> = {
	F: ['R', 'S'],
	R: ['T', 'F'],
	S: ['F', 'T'],
	T: ['S', 'R']
};

export function resourceTrack(r: Resource): Reward[][] {
	const kind = BUILDING_FOR[r];
	const [early, late] = CROSS[r];
	return [
		[],
		[{ t: 'explore', table: r }],
		[{ t: 'building', kind, tier: 1 }, cvp(5)],
		[{ t: 'fill', track: early }],
		[cvp(10)],
		[],
		[{ t: 'reroll' }],
		[{ t: 'building', kind, tier: 2 }, cvp(5)],
		[{ t: 'fill', track: late }],
		[cvp(15)],
		[],
		[{ t: 'set' }],
		[{ t: 'building', kind, tier: 3 }, cvp(5)],
		[any],
		[cvp(20)]
	];
}
export const RESOURCE_BOXES = 15;

export const CONQUEST: Reward[][] = [3, 3, 3, 6, 4, 4, 4, 8, 5, 5, 5, 10].map((n, i) =>
	i % 4 === 0 ? [cvp(n), any] : [cvp(n)]
);

export const AGGRESSION_BOXES = 12;
