import { describe, expect, it } from 'vitest';
import { battlePlacement, battleSpots } from './map-battles';

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
