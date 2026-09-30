import { describe, expect, it } from 'vitest';
import { aggressorCount, byes, eligibleForRound, nextPicker, rankEntries, rollOffNeeded } from './round';

const e = (id: string, aggressions: number, ...rolls: number[]) => ({ id, aggressions, rolls });

describe('eligibleForRound', () => {
	it('takes warbands with games left that are not already in a battle', () => {
		const ws = [
			{ id: 'a', games: 2, busy: false },
			{ id: 'b', games: 8, busy: false },
			{ id: 'c', games: 1, busy: true },
			{ id: 'd', games: 0, busy: false }
		];
		expect(eligibleForRound(ws, 8)).toEqual(['a', 'd']);
	});
});

describe('aggressorCount', () => {
	it('is half the field, rounded down', () => {
		expect([2, 3, 4, 5, 8, 1, 0].map(aggressorCount)).toEqual([1, 1, 2, 2, 4, 0, 0]);
	});
});

describe('rankEntries', () => {
	it('puts fewer times Aggressor first, then the higher roll, then re-rolls in order', () => {
		const ranked = rankEntries([e('a', 2, 6), e('b', 1, 3), e('c', 1, 5), e('d', 1, 5, 2), e('e', 1, 5, 4)]);
		expect(ranked.map((x) => x.id)).toEqual(['e', 'd', 'c', 'b', 'a']);
	});
});

describe('rollOffNeeded', () => {
	it('waits until everyone has rolled', () => {
		expect(rollOffNeeded([e('a', 0, 3), e('b', 0)])).toEqual({ waiting: ['b'], reroll: [] });
	});
	it('re-rolls a tie that straddles the Aggressor cut', () => {
		// 4 players → 2 Aggressors: a is in; b and c tie for the second place.
		expect(rollOffNeeded([e('a', 0, 6), e('b', 0, 4), e('c', 0, 4), e('d', 0, 1)])).toEqual({ waiting: [], reroll: ['b', 'c'] });
	});
	it('re-rolls a tie among the Aggressors too, since it decides who picks first', () => {
		expect(rollOffNeeded([e('a', 0, 5), e('b', 0, 5), e('c', 0, 2), e('d', 0, 1)])).toEqual({ waiting: [], reroll: ['a', 'b'] });
	});
	it('leaves a tie among the non-Aggressors alone, and asks only the tied players to roll again', () => {
		expect(rollOffNeeded([e('a', 0, 6), e('b', 0, 5), e('c', 0, 2), e('d', 0, 2)])).toEqual({ waiting: [], reroll: [] });
		expect(rollOffNeeded([e('a', 0, 5, 3), e('b', 0, 5)])).toEqual({ waiting: ['b'], reroll: [] });
	});
	it('needs nobody to roll off when the Aggressor history already decides', () => {
		expect(rollOffNeeded([e('a', 0, 1), e('b', 1, 6)])).toEqual({ waiting: [], reroll: [] });
	});
});

describe('picking', () => {
	const aggressors = ['a', 'b'];
	it('goes to the first Aggressor who has not picked', () => {
		expect(nextPicker(aggressors, new Set())).toBe('a');
		expect(nextPicker(aggressors, new Set(['a']))).toBe('b');
		expect(nextPicker(aggressors, new Set(['a', 'b']))).toBe(null);
	});
	it('sits out the non-Aggressors nobody picked', () => {
		expect(byes(['c', 'd', 'e'], new Set(['c', 'e']))).toEqual(['d']);
	});
});
