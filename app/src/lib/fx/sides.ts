/** Where each side stands on a battlefield: out to either side of the zone, clear of the two warbands'
 * markers (which stand on its centre while they fight). No pixi here: the map's markup imports it. */
export const SIDE_OFFSET = 110;
export const sides = (at: { x: number; y: number }) => ({
	aggressor: { x: at.x - SIDE_OFFSET, y: at.y + 20 },
	defender: { x: at.x + SIDE_OFFSET, y: at.y + 8 }
});
