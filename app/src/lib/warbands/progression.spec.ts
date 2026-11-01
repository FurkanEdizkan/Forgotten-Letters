/**
 * Tables, skills, promotions, keywords and armour.
 * Reused from archive/carcass-front-v1:app/src/lib/progression.spec.ts and keywords.spec.ts, rewritten to ids and the rules folder format.
 */
import { describe, expect, it } from 'vitest';
import {
	advancementsDue,
	applyStat,
	assignPromotionDice,
	coverage,
	effectsOf,
	nextAdvancement,
	roll,
	rollPromotions,
	rowFor,
	rowOf,
	skillFrom
} from './progression.ts';
import { keywordLabel, explain } from './keywords.ts';
import { armourOf, buildModel } from './model.ts';
import { resolveFaction } from './resolve.ts';
import { core, U } from './fixtures/core.ts';
import { fighter, wb } from './fixtures/build.ts';
import type { Table } from '../rules/pack.ts';

// Made-up tables in the rules folder's shape.
const skills: Table = {
	id: 'table:skills-test',
	name: 'Test Skills',
	kind: 'skill',
	dice: '2D6',
	rows: [
		{ roll: '2', name: 'Patron', effects: { patronSkill: true } },
		{ roll: '3-4', name: 'Brawler' },
		{ roll: '5-7', name: 'Iron Grip', effects: { keywords: ['kw:strong'] } },
		{ roll: '8-10', name: 'Sure Shot' },
		{ roll: '11-12', name: 'Fleet', effects: { stats: { movement: 1 } } }
	]
};
const trauma: Table = {
	id: 'table:trauma-test',
	name: 'Trauma',
	kind: 'trauma',
	dice: 'D66',
	rows: [
		{ roll: '11-16', name: 'Dead', effects: { dead: true } },
		{ roll: '21-36', name: 'Head Wound', effects: { noExperience: true } },
		{ roll: '41-56', name: 'Lame', effects: { stats: { movement: -1 } } },
		{ roll: '61-66', name: 'Full Recovery' }
	]
};

describe('tables', () => {
	it('find the row a roll lands on, and check every roll is covered once', () => {
		expect(rowFor(skills, 6)?.name).toBe('Iron Grip');
		expect(rowFor(trauma, 34)?.name).toBe('Head Wound');
		expect(coverage(skills)).toEqual({ missing: [], doubled: [] });
		expect(coverage({ ...trauma, rows: trauma.rows.slice(1) }).missing).toContain(11);
		expect(rowOf('table:trauma-test#41-56', [trauma])?.row.name).toBe('Lame');
		expect(rowOf('table:trauma-test#45', [trauma])?.row.name).toBe('Lame');
		expect(rowOf('Sure Shot', [skills, trauma])?.row.roll).toBe('8-10');
	});
	it('roll each kind of dice', () => {
		const d =
			(...xs: number[]) =>
			() =>
				xs.shift()!;
		expect(roll('D66', d(3, 5)).total).toBe(35);
		expect(roll('2D6', d(3, 5)).total).toBe(8);
		expect(roll('D3', d(5)).total).toBe(3);
	});
});

describe('experience and skills', () => {
	it('advancements owed at each threshold, and the next one', () => {
		expect(advancementsDue([2, 4, 7], 4, 0)).toBe(2);
		expect(advancementsDue([2, 4, 7], 4, 2)).toBe(0);
		expect(nextAdvancement([7, 2, 4], 4)).toBe(7);
	});
	it("a skill already known gives the next lowest, else the next highest; Patron results offer the Patron's", () => {
		expect(skillFrom(skills, 9, [])?.name).toBe('Sure Shot');
		expect(skillFrom(skills, 9, ['Sure Shot'])?.name).toBe('Iron Grip');
		expect(skillFrom(skills, 3, ['Brawler'])?.name).toBe('Iron Grip');
		expect(skillFrom(skills, 2, [], ['Blessing', 'Zeal'])).toMatchObject({
			name: 'Blessing or Zeal',
			patron: true
		});
	});
	it("what a model's skills and injuries do to it", () => {
		const e = effectsOf(
			['Iron Grip', 'Lame', 'Fleet', 'Head Wound', 'Something Else'],
			[skills, trauma]
		);
		expect(e.stats.movement).toBe(0);
		expect(e.keywords).toEqual(['kw:strong']);
		expect(e.noExperience).toBe(true);
		expect(e.unmatched).toEqual(['Something Else']);
		expect(applyStat('6"/Infantry', -1)).toBe('5"/Infantry');
		expect(applyStat('+1 DICE', -2)).toBe('-1 DICE');
		expect(applyStat('-1', 1)).toBe('0');
	});
	it('a skill row that gives STRONG lets the model carry two HEAVY pieces', () => {
		const f = resolveFaction(core, 'faction:order');
		const x = fighter(U('trooper'), { skills: ['table:trauma#5-6'] });
		expect(buildModel(wb([x]), f, x)?.keywords.has('kw:strong')).toBe(true);
	});
});

describe('promotions', () => {
	it('dice go round the Troops evenly; a 6 promotes; five misses make the sixth a 6', () => {
		expect(assignPromotionDice(5, 2)).toEqual([3, 2]);
		const d =
			(...xs: number[]) =>
			() =>
				xs.shift() ?? 1;
		const r = rollPromotions([2, 3], 0, 5, 6, d(2, 6, 1, 1, 1));
		expect(r.results.map((x) => x.promoted)).toEqual([true, false]);
		expect(r.streak).toBe(3);
		expect(rollPromotions([2], 4, 5, 6, d(1, 1)).results[0]).toEqual({
			dice: [1, 6],
			promoted: true
		});
		expect(rollPromotions([1, 1], 5, 5, 1, d()).results.filter((x) => x.promoted)).toHaveLength(1);
	});
});

describe('keywords and armour', () => {
	it('a keyword with its value, and NEGATE X explains X', () => {
		expect(keywordLabel(core, { kw: 'kw:negate', value: 'kw:fear' })).toBe('NEGATE FEAR');
		expect(keywordLabel(core, { kw: 'kw:blast', value: 3 })).toBe('BLAST 3"');
		expect(explain(core, { kw: 'kw:negate', value: 'kw:fear' })).toBe(
			'NEGATE does a thing.\n\nFEAR: FEAR does a thing.'
		);
		expect(explain(core, { kw: 'kw:nothing' })).toBeNull();
	});
	it('the Armour characteristic counts bought armour, not fixed kit', () => {
		const f = resolveFaction(core, 'faction:order');
		const t = fighter(U('trooper'), { kit: ['line:order/plate'] });
		expect(armourOf(buildModel(wb([t]), f, t)!, f)).toBe('-2');
		const h = fighter(U('hellknight'));
		expect(armourOf(buildModel(wb([h]), f, h)!, f)).toBe('-1');
	});
	it('a profile with two Armour values keeps them as printed, bought armour or not', () => {
		const f = resolveFaction(core, 'faction:order');
		const unit = f.idx.units.get(U('trooper'))!;
		const twin = { ...unit, stats: { ...unit.stats, armour: '-1/-2' } };
		f.idx.units.set(U('trooper'), twin);
		const t = fighter(U('trooper'), { kit: ['line:order/plate'] });
		expect(armourOf(buildModel(wb([t]), f, t)!, f)).toBe('-1/-2');
	});
});
