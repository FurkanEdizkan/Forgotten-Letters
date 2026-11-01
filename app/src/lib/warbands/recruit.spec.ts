/** Recruiting with the upgrades and loadout picked in the dialog, checked as one purchase. */
import { describe, expect, it } from 'vitest';
import { canRecruitWith, loadoutOptions } from './recruit.ts';
import { resolveFaction } from './resolve.ts';
import { core, U } from './fixtures/core.ts';
import { wb } from './fixtures/build.ts';
import type { Check } from './types.ts';

const order = resolveFaction(core, 'faction:order');
const why = (c: Check) => (c.ok ? 'ok' : c.reasons.join(' | '));
const L = (i: string) => `line:order/${i}`;

describe('recruiting with choices', () => {
	it('lists each way to fill the loadouts as lines', () => {
		expect(loadoutOptions(order, U('mamluk')).map((o) => o.label)).toEqual([
			'Greatsword',
			'Polearm and Wall Shield',
			'Pistol and Sword',
			'Pistol and Knife'
		]);
		expect(loadoutOptions(order, U('mamluk'))[1]!.lines).toEqual([L('polearm'), L('shield')]);
		expect(loadoutOptions(order, U('thrall'))).toEqual([]);
	});
	it('takes a loadout with the recruit, and refuses kit outside it', () => {
		expect(canRecruitWith(wb([]), order, U('mamluk'), { kit: [L('greatsword')] }).ok).toBe(true);
		expect(
			why(canRecruitWith(wb([]), order, U('mamluk'), { kit: [L('greatsword'), L('pistol')] }))
		).toMatch(/Only one of/);
	});
	it('pays as it goes: the recruit leaves too little for its kit', () => {
		const poor = wb([], { stashDucats: 35 });
		expect(why(canRecruitWith(poor, order, U('mamluk'), { kit: [L('greatsword')] }))).toMatch(
			/Costs 12 Ducats; 5 in the strongbox/
		);
	});
});
