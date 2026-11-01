/** canChange: a change may leave the list unfinished, never newly break a maximum or the banks. */
import { describe, expect, it } from 'vitest';
import { canChange } from './change.ts';
import { resolveFaction } from './resolve.ts';
import { core, U } from './fixtures/core.ts';
import { elite, wb } from './fixtures/build.ts';
import type { Check } from './types.ts';

const order = resolveFaction(core, 'faction:order');
const why = (c: Check) => (c.ok ? 'ok' : c.reasons.join(' | '));

describe('canChange', () => {
	it('lets a change leave the list unfinished (no Leader, nobody at all)', () => {
		const captain = elite(U('captain'));
		expect(canChange(wb([captain]), wb([]), order).ok).toBe(true);
	});
	it('refuses bringing a dead fighter back over its cap, and an overdrawn bank', () => {
		const a = elite(U('captain'));
		const b = elite(U('captain'), { group: 'dead' });
		expect(why(canChange(wb([a, b]), wb([a, { ...b, group: 'elite' }]), order))).toMatch(
			/2 Captain: the limit is 1/
		);
		expect(why(canChange(wb([a]), wb([a], { stashDucats: -5 }), order))).toMatch(/5 Ducats short/);
	});
	it('does not refuse what was already wrong before', () => {
		const before = wb([elite(U('captain'))], { stashDucats: -5 });
		expect(canChange(before, { ...before, name: 'Renamed' }, order).ok).toBe(true);
	});
});
