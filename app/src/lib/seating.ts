/** Players the official map is balanced for; house zones E, F and 1–6 extend it to 16. */
export const OFFICIAL_MAX_PLAYERS = 12;
export const EXTENDED_MAX_PLAYERS = 16;

/**
 * Suggested Entry Zone for a seat: players are split as evenly as possible over the
 * Entry Zones in use, earlier zones taking the remainder. Seating is only a suggestion —
 * any number of players may share an Entry Zone.
 *
 * With 16 players and house zones this gives the Player's Guide's layout
 * (A–D three each, E and F two each); with 12 or fewer on the official map, A–D evenly.
 */
export function suggestedEntry(seat: number | null | undefined, players: number, houseZones: boolean): string {
	const entries = houseZones ? ['A', 'B', 'C', 'D', 'E', 'F'] : ['A', 'B', 'C', 'D'];
	const n = Math.max(players, seat ?? 1, 1);
	const s = Math.max(1, seat ?? 1);
	const base = Math.floor(n / entries.length);
	const extra = n % entries.length;
	let upTo = 0;
	for (let i = 0; i < entries.length; i++) {
		upTo += base + (i < extra ? 1 : 0);
		if (s <= upTo) return entries[i];
	}
	return entries[(s - 1) % entries.length];
}
