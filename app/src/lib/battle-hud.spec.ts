import { describe, expect, it } from 'vitest';
import { hudRoster } from './battle-hud';

const unit = (id: string, leader = false) => ({ id, leader });

describe('hudRoster', () => {
	it('puts the leader first and keeps the roster order otherwise', () => {
		expect(hudRoster([unit('a'), unit('b'), unit('boss', true), unit('c')]).map((u) => u.id)).toEqual(['boss', 'a', 'b', 'c']);
	});
	it('leaves a roster with no leader as it is, without changing the original', () => {
		const roster = [unit('b'), unit('a')];
		expect(hudRoster(roster).map((u) => u.id)).toEqual(['b', 'a']);
		expect(hudRoster([])).toEqual([]);
		expect(roster.map((u) => u.id)).toEqual(['b', 'a']);
	});
});
