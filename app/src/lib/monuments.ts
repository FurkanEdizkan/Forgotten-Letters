/**
 * Victory monuments: which frame of static/fx/monuments.webp a winner raises, and how big.
 * Order matches MONUMENT_FACTIONS in scripts/fx/render_fx.py; the last frame is a draw's cairn.
 */
export const MONUMENT_FACTIONS = [
	'new-antioch',
	'trench-pilgrims',
	'iron-sultanate',
	'heretic-legions',
	'black-grail',
	'seven-headed-serpent',
	'procession-of-the-sacred-affliction',
	'heretic-naval-raiders'
] as const;

export const CAIRN_FRAME = MONUMENT_FACTIONS.length;

/** The winner's monument, or the cairn for a draw (or a faction without one). */
export function monumentFrame(winnerFaction: string | null) {
	const i = MONUMENT_FACTIONS.indexOf(winnerFaction as (typeof MONUMENT_FACTIONS)[number]);
	return i < 0 ? CAIRN_FRAME : i;
}

/** A crushing win raises a bigger monument than a hard-fought one. */
export const TIER_SCALE = { 1: 0.8, 2: 1, 3: 1.3 } as const;

/** '#rrggbb' → 0xrrggbb, and a colour mixed towards another (k = 0…1). */
export const hexNum = (h: string) => parseInt(h.replace('#', ''), 16) || 0;
export function mix(a: number, b: number, k: number) {
	const ch = (n: number, s: number) => (n >> s) & 255;
	const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * k) << s;
	return m(16) | m(8) | m(0);
}
