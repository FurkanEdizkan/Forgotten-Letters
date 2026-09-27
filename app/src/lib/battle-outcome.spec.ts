import { describe, expect, it } from 'vitest';
import { outcome } from './battle-outcome';

const side = (x: Partial<{ deeds: number; vp: number; fallen: number }>) => ({ deeds: 0, fills: [], ...x });
const g = (winnerId: string | null, a: object, d: object) => ({
	aggressorId: 'a',
	defenderId: 'd',
	winnerId,
	result: { sides: { a: side(a), d: side(d) } }
});

describe('battle outcome', () => {
	it('grades the win by Victory Points', () => {
		expect(outcome(g('a', { vp: 5 }, { vp: 4 })).tier).toBe(1);
		expect(outcome(g('a', { vp: 7 }, { vp: 3 })).tier).toBe(2);
		expect(outcome(g('d', { vp: 2 }, { vp: 8 }))).toMatchObject({ tier: 3, winner: 'd', loser: 'a', margin: 6 });
	});
	it('falls back to Glorious Deeds when no VP were entered', () => {
		expect(outcome(g('a', { deeds: 4 }, { deeds: 1 }))).toMatchObject({ margin: 3, tier: 2 });
	});
	it('makes a rout crushing, counts and caps the fallen', () => {
		const o = outcome(g('a', { vp: 3, fallen: 2 }, { vp: 2, fallen: 30 }));
		expect(o).toMatchObject({ tier: 3, fallen: { aggressor: 2, defender: 30 }, corpses: 24 });
	});
	it('handles draws and results from before these fields', () => {
		expect(outcome(g(null, {}, {}))).toMatchObject({ draw: true, loser: null, tier: 1, corpses: 0 });
		expect(outcome({ aggressorId: 'a', defenderId: 'd', winnerId: 'a', result: null }).margin).toBe(0);
	});
});
