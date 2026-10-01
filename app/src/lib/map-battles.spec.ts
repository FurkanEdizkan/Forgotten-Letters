import { describe, expect, it } from 'vitest';
import { battlePlacement, battleSpots, ringSpots, battleFlanks } from './map-battles';

const round = (p: { x: number; y: number }) => ({ x: Math.round(p.x), y: Math.round(p.y) });

describe('battleSpots', () => {
	it('keeps a lone battle on its zone', () => {
		expect(battleSpots({ x: 100, y: 100 }, 1)).toEqual([{ x: 100, y: 100 }]);
	});
	it('spreads several evenly round the zone, the first above it', () => {
		expect(battleSpots({ x: 100, y: 100 }, 2, 50).map(round)).toEqual([
			{ x: 100, y: 50 },
			{ x: 100, y: 150 }
		]);
		expect(battleSpots({ x: 0, y: 0 }, 4, 10).map(round)).toEqual([
			{ x: 0, y: -10 },
			{ x: 10, y: 0 },
			{ x: 0, y: 10 },
			{ x: -10, y: 0 }
		]);
	});
});

describe('battlePlacement', () => {
	it('places each battle, sharing out only the zones that hold more than one', () => {
		const centre = (z: string) => (z === 'lost' ? null : { a: { x: 0, y: 0 }, b: { x: 500, y: 0 } }[z]!);
		const at = battlePlacement(
			[
				{ id: 'g1', zone: 'a' },
				{ id: 'g2', zone: 'b' },
				{ id: 'g3', zone: 'a' },
				{ id: 'g4', zone: 'lost' }
			],
			centre,
			50
		);
		expect(round(at.get('g1')!)).toEqual({ x: 0, y: -50 });
		expect(round(at.get('g3')!)).toEqual({ x: 0, y: 50 });
		expect(at.get('g2')).toEqual({ x: 500, y: 0 });
		expect(at.has('g4')).toBe(false);
	});
});

describe('ringSpots', () => {
	const R = 72;
	const m = 14;
	const angleFromBottom = (p: { x: number; y: number }) => Math.abs(Math.atan2(p.x, p.y));
	it('stands on the zone\'s own circle, clear of the name banner at the bottom', () => {
		for (const p of ringSpots(6, R, m)) {
			expect(Math.hypot(p.x, p.y)).toBeCloseTo(R, 5);
			expect(angleFromBottom(p)).toBeGreaterThanOrEqual((50 * Math.PI) / 180 - 1e-9);
		}
	});
	it('starts at the right shoulder, then the left, low down', () => {
		const [a, b] = ringSpots(2, R, m);
		expect(a.x).toBeGreaterThan(0);
		expect(b.x).toBeLessThan(0);
		expect(a.y).toBeGreaterThan(0);
		expect(b.y).toBeCloseTo(a.y, 5);
	});
	it('never lets two markers overlap, however many share the zone', () => {
		for (const n of [1, 5, 12, 16, 24]) {
			const spots = ringSpots(n, R, m);
			expect(spots).toHaveLength(n);
			for (let i = 0; i < n; i++)
				for (let j = i + 1; j < n; j++) expect(Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y), `n=${n}`).toBeGreaterThanOrEqual(2 * m - 1e-6);
		}
	});
	it('a full circle continues on a second one just outside', () => {
		const spots = ringSpots(16, R, m);
		const radii = [...new Set(spots.map((p) => Math.round(Math.hypot(p.x, p.y))))];
		expect(radii).toEqual([R, Math.round(R + 2.2 * m)]);
	});
});

describe('battleFlanks', () => {
	it('puts the Aggressor left and the Defender right, on the ring', () => {
		expect(battleFlanks(80)).toEqual([
			{ x: -80, y: 0 },
			{ x: 80, y: 0 }
		]);
	});
});
