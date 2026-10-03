import { describe, expect, it } from 'vitest';
import { readPatrons } from './patrons';
import { readTables } from './progression';

// Made-up results and Skills in the books' shapes, as the Rules Editor posts them.
describe('what the Patrons and Campaign editors write reads back unchanged', () => {
	const errs: string[] = [];
	const err = (p: string, m: string) => errs.push(`${p} ${m}`);
	it('a result with every kind of effect, and a Skill with rules and prices', () => {
		const effects = {
			dead: true,
			stats: { melee: -1, movement: 0 },
			keywords: ['FEAR'],
			remove_keywords: ['INFILTRATOR'],
			extra_xp: 'D3',
			extra_scars: 1,
			limits: [{ items: { keywords: ['HEAVY'] }, max: 0 }],
			lose_kit: { keywords: ['HEAVY'] },
			not_counted_elite: true
		};
		const rows = [
			{ roll: '1-3', name: 'Bad', text: 'It hurts.', effects },
			{ roll: '4-6', name: 'Fine', text: 'Nothing.' }
		];
		const [t] = readTables([{ id: 'made-up', name: 'Made up', dice: 'D6', text: '', rows }], err);
		expect(t.rows).toEqual(rows);
		const skills = [{ name: 'Gift', text: 'A gift.', limits: [{ who: { keywords: ['ELITE'] }, items: { categories: ['armour'] }, min: 1 }], prices: [{ items: { categories: ['armour'], min_cost: 15 }, less: 5 }] }];
		const [p] = readPatrons([{ name: 'Someone', alignment: 'faithful', factions: ['new-antioch'], variants: [], text: 'Hm.', skills }], err);
		expect(p.skills).toEqual(skills);
		expect(errs).toEqual([]);
	});
});
