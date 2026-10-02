import { describe, expect, it } from 'vitest';
import { advancementsDue, applyStat, assignPromotionDice, coverage, effectsOf, nextAdvancement, readProgression, readTables, roll, rollPromotions, rowFor, skillFrom, type CampaignTable, type Progression } from './progression';

// Made-up tables in the books' shapes (no book text lives in the repository).
const skills: CampaignTable = {
	id: 'skills-test',
	name: 'Test Skills',
	dice: '2D6',
	source: null,
	text: '',
	rows: [
		{ roll: '2', name: 'Patron', text: '', effects: { patron_skill: true } },
		{ roll: '3-4', name: 'Brawler', text: '' },
		{ roll: '5-7', name: 'Iron Grip', text: '', effects: { keywords: ['STRONG'] } },
		{ roll: '8-10', name: 'Sure Shot', text: '' },
		{ roll: '11-12', name: 'Fleet', text: '', effects: { stats: { movement: 1 } } }
	]
};
const trauma: CampaignTable = {
	id: 'trauma',
	name: 'Trauma',
	dice: 'D66',
	source: null,
	text: '',
	rows: [
		{ roll: '11-16', name: 'Dead', text: '', effects: { dead: true } },
		{ roll: '21-36', name: 'Head Wound', text: '', effects: { no_experience: true } },
		{ roll: '41-56', name: 'Lame', text: '', effects: { stats: { movement: -1 } } },
		{ roll: '61-66', name: 'Full Recovery', text: '' }
	]
};
const p: Progression = { advancementAt: [2, 4, 7], promotion: { baseDice: 1, perGloriousDeed: 1, autoAfter: 5, maxElite: 6 }, advancement: { tablesToPick: 2, dice: '2D6' }, text: '' };

describe('tables', () => {
	it('find the row a roll lands on, and check every roll is covered once', () => {
		expect(rowFor(skills, 6)?.name).toBe('Iron Grip');
		expect(rowFor(trauma, 34)?.name).toBe('Head Wound');
		expect(coverage(skills)).toEqual({ missing: [], doubled: [] });
		expect(coverage({ ...trauma, rows: trauma.rows.slice(1) }).missing).toContain(11);
	});
	it('roll each kind of dice', () => {
		const d = (...xs: number[]) => () => xs.shift()!;
		expect(roll('D66', d(3, 5)).total).toBe(35);
		expect(roll('2D6', d(3, 5)).total).toBe(8);
		expect(roll('D3', d(5)).total).toBe(3);
	});
	it('read from a pack: unknown keys and gaps refused', () => {
		const errors: string[] = [];
		const err = (path: string, m: string) => errors.push(`${path}: ${m}`);
		const [t] = readTables([{ id: 'x', name: 'X', dice: 'D6', rows: [{ roll: '1-3', name: 'A', text: '' }, { roll: '4-6', name: 'B', text: '', effects: { stats: { melee: 1 } } }] }], err);
		expect(errors).toEqual([]);
		expect(t.rows[1].effects?.stats?.melee).toBe(1);
		readTables([{ id: 'y', name: 'Y', dice: 'D6', rows: [{ roll: '1-5', name: 'A', text: '', effects: { deadd: true } }] }], err);
		expect(errors.join()).toMatch(/deadd/);
		expect(errors.join()).toMatch(/no row for 6/);
		expect(readProgression({ advancement_at: [7, 2, 4] }, err)?.advancementAt).toEqual([2, 4, 7]);
	});
});

describe('experience and skills', () => {
	it('advancements owed at each threshold, and the next one', () => {
		expect(advancementsDue(p, 4, 0)).toBe(2);
		expect(advancementsDue(p, 4, 2)).toBe(0);
		expect(nextAdvancement(p, 4)).toBe(7);
	});
	it("a skill already known gives the next lowest, else the next highest; Patron results give the Patron's", () => {
		expect(skillFrom(skills, 9, [])?.name).toBe('Sure Shot');
		expect(skillFrom(skills, 9, ['Sure Shot'])?.name).toBe('Iron Grip');
		expect(skillFrom(skills, 3, ['Brawler'])?.name).toBe('Iron Grip');
		expect(skillFrom(skills, 2, [], ['Blessing', 'Zeal'])).toMatchObject({ name: 'Blessing or Zeal', patron: true });
	});
	it("what a model's skills and injuries do to it", () => {
		const e = effectsOf(['Iron Grip', 'Lame', 'Fleet', 'Head Wound', 'Something Else'], [skills, trauma]);
		expect(e.stats.movement).toBe(0);
		expect(e.keywords).toEqual(['STRONG']);
		expect(e.noExperience).toBe(true);
		expect(e.unmatched).toEqual(['Something Else']);
		expect(applyStat('6"/Infantry', -1)).toBe('5"/Infantry');
		expect(applyStat('+1 DICE', -2)).toBe('-1 DICE');
		expect(applyStat('-1', 1)).toBe('0');
	});
});

describe('promotions', () => {
	it('dice go round the Troops evenly; a 6 promotes; five misses make the sixth a 6', () => {
		expect(assignPromotionDice(5, 2)).toEqual([3, 2]);
		const d = (...xs: number[]) => () => xs.shift() ?? 1;
		const r = rollPromotions([2, 3], 0, 5, 6, d(2, 6, 1, 1, 1));
		expect(r.results.map((x) => x.promoted)).toEqual([true, false]);
		expect(r.streak).toBe(3);
		const auto = rollPromotions([2], 4, 5, 6, d(1, 1));
		expect(auto.results[0]).toEqual({ dice: [1, 6], promoted: true });
		expect(rollPromotions([1, 1], 5, 5, 1, d()).results.filter((x) => x.promoted)).toHaveLength(1);
	});
});
