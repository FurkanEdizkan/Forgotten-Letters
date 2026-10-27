/**
 * The arcane ring around the emblem: invented glyphs from a seeded generator, so every page and every render (server
 * and browser) draws the same ring, and the script spells nothing real. Pure: returns path data, draws nothing.
 */

/** The ring's centre in the emblem's coordinates (the cross's halo sits at 50 40; the ring is centred lower). */
export const RING_CENTRE = { x: 50, y: 60 } as const;
export const GLYPH_COUNT = 54;
export const DEFAULT_SEED = 1789;
const GLYPH_RADIUS = 99;

export type RingCircle = { r: number; strokeWidth: number; opacity: number; dash?: string };
export type RingMark = { d: string; transform: string };
export type ArcaneRing = { circles: RingCircle[]; glyphs: RingMark[]; diamonds: RingMark[] };

/** A linear congruential generator (Numerical Recipes constants): tiny, and the same on every engine. */
function lcg(seed: number) {
	let s = seed;
	return () => {
		s = (s * 1664525 + 1013904223) % 4294967296;
		return s / 4294967296;
	};
}

/**
 * Build the ring for a seed. The order of random draws matches the review page's sketch, so the ring looks the same
 * as the approved one.
 */
export function arcaneRing(seed: number = DEFAULT_SEED): ArcaneRing {
	const rnd = lcg(seed);
	const strokes: Array<() => string> = [
		() => 'M0 -6V6',
		() => `M${-3 + rnd() * 2} -6L${1 + rnd() * 2} 6`,
		() => 'M-3 -2H3',
		() => `M-3 ${2 + rnd() * 2}H3`,
		() => 'M-2.4 -3.4a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0',
		() => 'M-3 6Q0 0 3 6',
		() => 'M-3 -6L0 -2L3 -6',
		() => 'M3 -6Q-3 0 3 6',
		() => 'M-1 4h2'
	];
	const glyph = () => {
		const parts: string[] = [];
		const n = 2 + Math.floor(rnd() * 3);
		for (let i = 0; i < n; i++) parts.push(strokes[Math.floor(rnd() * strokes.length)]!());
		return parts.join(' ');
	};
	const at = (deg: number) =>
		`translate(${RING_CENTRE.x} ${RING_CENTRE.y}) rotate(${deg}) translate(0 -${GLYPH_RADIUS})`;

	const glyphs: RingMark[] = [];
	for (let i = 0; i < GLYPH_COUNT; i++)
		glyphs.push({ d: glyph(), transform: at((360 / GLYPH_COUNT) * i) });

	// Small diamonds at the four quarters break the script into verses; each sits between two glyphs.
	const diamonds: RingMark[] = [0, 1, 2, 3].map((q) => ({
		d: 'M0 -5L3 0L0 5L-3 0Z',
		transform: at(q * 90 + 360 / GLYPH_COUNT / 2)
	}));

	// Two circles bound the band of script; a thin inner circle carries tick marks.
	const circles: RingCircle[] = [
		{ r: 110, strokeWidth: 1.6, opacity: 0.85 },
		{ r: 88, strokeWidth: 1.2, opacity: 0.85 },
		{ r: 80, strokeWidth: 0.6, opacity: 0.6, dash: '1 5.6' }
	];

	return { circles, glyphs, diamonds };
}
