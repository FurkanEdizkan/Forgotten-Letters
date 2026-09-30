import { describe, expect, it } from 'vitest';
import { battlePlacement, battleSpots, markerSpots, battleFlanks } from './map-battles';

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

describe('markerSpots', () => {
	it("keeps every warband marker off the zone's own tap target, at any zoom", () => {
		for (const k of [1, 2, 3.5])
			for (const n of [1, 2, 5]) {
				const spots = markerSpots(n, k, { clear: 70, markerR: 35 });
				expect(spots).toHaveLength(n);
				// In the map's units a spot sits k times further out (the marker group is scaled by k).
				for (const p of spots) expect(Math.hypot(p.x, p.y) * k - 35 * k, `n=${n} k=${k}`).toBeGreaterThanOrEqual(70);
			}
	});
	it('puts a lone warband up and to the right of its zone', () => {
		const [p] = markerSpots(1, 1, { clear: 70, markerR: 35 });
		expect(p.x).toBeGreaterThan(0);
		expect(p.y).toBeLessThan(0);
	});
});

describe('battleFlanks', () => {
	it('stands the Aggressor on the left of the battle ring and the Defender on the right, at any zoom', () => {
		for (const k of [1, 2, 3.5]) {
			const [a, d] = battleFlanks(80, k);
			expect(a.y).toBe(0);
			expect(d.y).toBe(0);
			expect(a.x).toBeLessThan(0);
			expect(d.x).toBe(-a.x);
			// In the map's units the marker's centre sits on the ring itself, so it reaches no further than it must.
			expect(Math.round(d.x * k)).toBe(80);
		}
	});
});
