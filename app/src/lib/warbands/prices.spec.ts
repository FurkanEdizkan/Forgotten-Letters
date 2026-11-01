/**
 * Prices by rule and the rating.
 * Reused from archive/carcass-front-v1:app/src/lib/warband-limits.spec.ts (prices by rule), rewritten to ids and the rules folder format.
 */
import { describe, expect, it } from 'vitest';
import { priceOf, rating } from './prices.ts';
import { resolveFaction } from './resolve.ts';
import { core, U, withRules } from './fixtures/core.ts';
import { elite, fighter, wb } from './fixtures/build.ts';
import type { PriceRule } from '../rules/pack.ts';

const order = (...prices: PriceRule[]) => resolveFaction(withRules({ prices }), 'faction:order');
const L = (i: string) => `line:order/${i}`;

describe('prices by rule', () => {
	it('the first copy of each melee weapon at half price, rounded up', () => {
		const f = order({ items: { categories: ['melee'] }, first: true, factor: 0.5 });
		const x = fighter(U('trooper'));
		expect(priceOf(wb([x]), f, { lineId: L('greatsword'), fighterId: x.id })).toEqual({
			cost: 6,
			currency: 'ducats'
		});
		expect(
			priceOf(wb([x], { stash: ['line:order/greatsword'] }), f, {
				lineId: L('greatsword'),
				fighterId: x.id
			}).cost
		).toBe(12);
		expect(priceOf(wb([x]), f, { lineId: L('knife'), fighterId: x.id }).cost).toBe(3);
		// In the rating, only the first one listed is cheap.
		const two = [
			fighter(U('trooper'), { kit: ['line:order/greatsword'] }),
			fighter(U('trooper'), { kit: ['line:order/greatsword'] })
		];
		expect(rating(wb(two), f).ducats).toBe(20 + 6 + 20 + 12);
	});

	it("a buyer's price (who), and a discount while such a model is in the warband (while)", () => {
		const f = order(
			{ items: { items: ['item:rifle'] }, cost: 5, who: { units: [U('sergeant')] } },
			{ items: { categories: ['armour'] }, less: 5, while: { units: [U('captain')] } }
		);
		const s = elite(U('sergeant'));
		const t = fighter(U('trooper'));
		expect(priceOf(wb([s, t]), f, { lineId: L('rifle'), fighterId: s.id }).cost).toBe(5);
		expect(priceOf(wb([s, t]), f, { lineId: L('rifle'), fighterId: t.id }).cost).toBe(10);
		expect(priceOf(wb([t]), f, { lineId: L('plate'), fighterId: t.id }).cost).toBe(30);
		expect(
			priceOf(wb([t, elite(U('captain'))]), f, { lineId: L('plate'), fighterId: t.id }).cost
		).toBe(25);
	});

	it('the second copy on one model costs Glory (copy)', () => {
		const f = order({ items: { items: ['item:charge'] }, copy: 2, cost: 2, currency: 'glory' });
		const x = fighter(U('trooper'));
		expect(priceOf(wb([x]), f, { lineId: L('charge'), fighterId: x.id })).toEqual({
			cost: 5,
			currency: 'ducats'
		});
		const y = fighter(U('trooper'), { kit: ['line:order/charge'] });
		expect(priceOf(wb([y]), f, { lineId: L('charge'), fighterId: y.id })).toEqual({
			cost: 2,
			currency: 'glory'
		});
	});

	it('the first Warlock costs 110 Ducats instead of its Glory (entries, first)', () => {
		const f = order({ entries: [U('warlock')], first: true, cost: 110, currency: 'ducats' });
		expect(priceOf(wb([]), f, { unitId: U('warlock') })).toEqual({ cost: 110, currency: 'ducats' });
		expect(priceOf(wb([elite(U('warlock'))]), f, { unitId: U('warlock') })).toEqual({
			cost: 3,
			currency: 'glory'
		});
		expect(rating(wb([elite(U('warlock')), elite(U('warlock'))]), f)).toEqual({
			ducats: 110,
			glory: 3
		});
	});

	it("a Patron Skill's discount holds while a model with the Skill is in the warband", () => {
		const f = resolveFaction(core, 'faction:order');
		const t = fighter(U('trooper'));
		const lord = elite(U('sergeant'), { skills: ['skill:saint/procurement'] });
		const s = wb([t, lord], { patronId: 'patron:saint' });
		expect(priceOf(s, f, { lineId: L('mail'), fighterId: t.id }).cost).toBe(10);
		expect(priceOf(s, f, { lineId: L('pistol'), fighterId: t.id }).cost).toBe(5);
		expect(priceOf({ ...s, fighters: [t] }, f, { lineId: L('mail'), fighterId: t.id }).cost).toBe(
			15
		);
	});

	it("the variant's free item: its first copy costs nothing", () => {
		const f = resolveFaction(core, 'faction:order', 'variant:order/pilgrims');
		const c = elite(U('captain'));
		expect(priceOf(wb([c]), f, { lineId: L('holy-relic'), fighterId: c.id }).cost).toBe(0);
		expect(
			rating(
				wb([
					{ ...c, kit: ['line:order/holy-relic'] },
					elite(U('sergeant'), { kit: ['line:order/holy-relic'] })
				]),
				f
			).ducats
		).toBe(60 + 40 + 20);
	});
});

describe('the rating', () => {
	it('fixed kit is free; kit flagged includedInCost is paid only under Q65 (b)', () => {
		const f = resolveFaction(core, 'faction:order');
		const s = wb([elite(U('hellknight'))]);
		expect(rating(s, f).ducats).toBe(100);
		expect(rating(s, f, { switches: { q65: 'b' } }).ducats).toBe(130);
		expect(priceOf(s, f, { unitId: U('hellknight') }, { switches: { q65: 'b' } }).cost).toBe(130);
		expect(rating(wb([fighter(U('medic'))]), f, { switches: { q65: 'b' } }).ducats).toBe(30);
	});

	it('Glory-priced things count no Ducats (Q38); the dead are off the table', () => {
		const f = resolveFaction(core, 'faction:order');
		const s = wb([
			fighter('unit:mercenaries/sellsword'),
			fighter(U('trooper'), {
				kit: ['line:glory-items/relic'],
				upgrades: ['upgrade:order/blessed']
			}),
			fighter(U('trooper'), { group: 'dead' })
		]);
		expect(rating(s, f)).toEqual({ ducats: 20, glory: 2 + 3 + 2 });
	});
});
