import { describe, expect, it } from 'vitest';
import { suggestedEntry } from './seating';

const layout = (players: number, house: boolean) =>
	Array.from({ length: players }, (_, i) => suggestedEntry(i + 1, players, house)).join('');

describe('suggested seating', () => {
	it("16 players with house zones follow the Player's Guide", () => {
		expect(layout(16, true)).toBe('AAABBBCCCDDDEEFF');
	});

	it('12 or fewer spread evenly over the official Entry Zones', () => {
		expect(layout(12, false)).toBe('AAABBBCCCDDD');
		expect(layout(8, false)).toBe('AABBCCDD');
		expect(layout(6, false)).toBe('AABBCD');
		expect(layout(2, false)).toBe('AB');
	});

	it('14 players with house zones fill all six', () => {
		expect(layout(14, true)).toBe('AAABBBCCDDEEFF');
	});
});
