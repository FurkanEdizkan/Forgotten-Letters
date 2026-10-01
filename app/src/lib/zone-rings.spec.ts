import { describe, expect, it } from 'vitest';
import { MIN_SCORE, fitRing, type Gray } from './zone-rings';

/** A blank sheet (book scale: 2398 wide, here halved like the app does) with inked circles drawn on it. */
function sheet(circles: { x: number; y: number; r: number }[], width = 1199, height = 802): Gray {
	const dark = new Uint8Array(width * height).fill(20);
	for (const c of circles)
		for (let y = Math.floor(c.y - c.r - 3); y <= c.y + c.r + 3; y++)
			for (let x = Math.floor(c.x - c.r - 3); x <= c.x + c.r + 3; x++) {
				const d = Math.abs(Math.hypot(x - c.x, y - c.y) - c.r);
				if (d < 2 && x >= 0 && y >= 0 && x < width && y < height) dark[y * width + x] = d < 1 ? 230 : 140;
			}
	return { dark, width, height };
}

describe('fitRing', () => {
	it('finds a printed circle from a pin placed off its centre', () => {
		const g = sheet([{ x: 400, y: 300, r: 36 }]);
		const ring = fitRing(g, 408, 290);
		expect(ring.score).toBeGreaterThan(MIN_SCORE);
		expect(Math.abs(ring.x - 400)).toBeLessThanOrEqual(1);
		expect(Math.abs(ring.y - 300)).toBeLessThanOrEqual(1);
		expect(Math.abs(ring.r - 36)).toBeLessThanOrEqual(1);
	});

	it('takes the zone, not a smaller drawing inside it', () => {
		const g = sheet([
			{ x: 600, y: 400, r: 52 },
			{ x: 600, y: 400, r: 18 }
		]);
		expect(Math.abs(fitRing(g, 600, 410).r - 52)).toBeLessThanOrEqual(1);
	});

	it('reaches a pin far off its circle with a wider look', () => {
		const g = sheet([{ x: 300, y: 300, r: 40 }]);
		const ring = fitRing(g, 300, 325);
		expect(Math.abs(ring.y - 300)).toBeLessThanOrEqual(1);
	});

	it('says so when there is nothing printed there', () => {
		expect(fitRing(sheet([]), 500, 400).score).toBeLessThan(MIN_SCORE);
	});
});
