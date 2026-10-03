import { describe, expect, it } from 'vitest';
import { describeLimit, readLimits, readLoadouts, readPrices, type Limit } from './warband-limits';

// Made-up limits in the books' shapes.
describe('a limit in plain words', () => {
	it('says what it counts, how many, for each what and while what', () => {
		expect(describeLimit({ items: { keywords: ['HEAVY'] }, max: 1 })).toBe('Each model carries at most 1 HEAVY items.');
		expect(describeLimit({ who: { category: ['elite'] }, items: { categories: ['armour'] }, min: 1 })).toBe('Each of Elite models carries at least 1 Armour.');
		expect(describeLimit({ items: { names: ['Trench Shield'] }, max: 0 })).toBe('Each model carries no Trench Shield.');
		expect(describeLimit({ upgrades: ['Goetic Power'], max: 2 })).toBe('Each model has at most 2 of the upgrades Goetic Power.');
		expect(describeLimit({ entries: ['Praetor', 'Sorcerer'], min: 1, max: 1 })).toBe('The warband has exactly 1 of Praetor or Sorcerer.');
		expect(describeLimit({ models: { entries: ['Castigator'] }, max: 1, per: { models: { entries: ['Communicant'] }, each: 2 } })).toBe(
			'The warband has at most 1 Castigator for each 2 Communicant.'
		);
		expect(describeLimit({ warband_items: { types: ['2-Handed'], max_cost: 10 }, max: 3 })).toBe('The warband carries at most 3 2-Handed items costing 10 Ducats or less.');
		expect(describeLimit({ models: { value_under: 80 }, max: 0, when: { present: { keywords: ['LEADER'] } } })).toBe(
			'The warband has no models, worth under 80 Ducats, while it has models, with LEADER.'
		);
	});
});

describe('what the editor writes reads back unchanged', () => {
	const errs: string[] = [];
	const err = (p: string, m: string) => errs.push(`${p} ${m}`);
	it('limits, prices and loadouts', () => {
		const limits: Limit[] = [
			{ text: 'At most one HEAVY', items: { keywords: ['HEAVY'] }, max: 1 },
			{ who: { not: { keywords: ['ELITE'] } }, count: 'weapons', items: { categories: ['melee', 'ranged'] }, max: 2 },
			{ models: { entries: ['Castigator'] }, max: 1, per: { models: { entries: ['Communicant'] }, each: 2, round: 'up' }, when: { rating_min: 300 } }
		];
		expect(readLimits(limits, 'l', err)).toEqual(limits);
		const prices = [{ items: { names: ['Rifle'] }, who: { entries: ['Yeoman'] }, cost: 5, currency: 'ducats' as const }, { entries: ['Sniper'], first: true, less: 10 }];
		expect(readPrices(prices, 'p', err)).toEqual(prices);
		const loadouts = [['Greatsword'], ['Polearm', ['Trench Shield', 'Buckler']]];
		expect(readLoadouts(loadouts, 'o', err)).toEqual(loadouts);
		expect(errs).toEqual([]);
	});
});
