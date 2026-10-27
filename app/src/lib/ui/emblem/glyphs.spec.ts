import { describe, expect, it } from 'vitest';
import { arcaneRing, DEFAULT_SEED, GLYPH_COUNT } from './glyphs';

describe('arcaneRing', () => {
	it('draws the same ring every time for the same seed', () => {
		expect(arcaneRing(DEFAULT_SEED)).toEqual(arcaneRing(DEFAULT_SEED));
		expect(arcaneRing()).toEqual(arcaneRing(1789));
	});

	it('has 54 glyphs, 4 diamonds and 3 circles', () => {
		const ring = arcaneRing();
		expect(GLYPH_COUNT).toBe(54);
		expect(ring.glyphs).toHaveLength(54);
		expect(ring.diamonds).toHaveLength(4);
		expect(ring.circles).toHaveLength(3);
	});

	it('gives every glyph two to four strokes of plain path data', () => {
		for (const g of arcaneRing().glyphs) {
			// Every stroke starts with exactly one M.
			const strokes = g.d.match(/M/g) ?? [];
			expect(strokes.length).toBeGreaterThanOrEqual(2);
			expect(strokes.length).toBeLessThanOrEqual(4);
			expect(g.d).toMatch(/^[MLHVQahv0-9 .-]+$/);
		}
	});

	it('spaces the glyphs evenly round the ring', () => {
		const angles = arcaneRing().glyphs.map((g) =>
			Number(/rotate\(([^)]+)\)/.exec(g.transform)?.[1])
		);
		expect(angles[0]).toBe(0);
		expect(angles[1]).toBeCloseTo(360 / 54);
		expect(angles[53]).toBeCloseTo((360 / 54) * 53);
	});

	it('draws a different ring for another seed', () => {
		expect(arcaneRing(7).glyphs).not.toEqual(arcaneRing().glyphs);
	});
});
