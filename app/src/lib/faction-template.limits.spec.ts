import { describe, expect, it } from 'vitest';
import { equipCheck, readRules, type ArmouryItem } from './warband-rules';
import { builderState, type BuilderInput } from './builder-state';
import { parseTemplate, toTemplate } from './faction-template';

// Made-up kit and entries in the books' shapes (no book text lives in the repository).
const item = (name: string, category: ArmouryItem['category'], type: string): ArmouryItem => ({ name, category, cost: 10, currency: 'ducats', limit: null, restrictions: null, type, range: null, keywords: [] });
const A = { pistol: item('Pistol', 'ranged', '1-Handed'), sword: item('Sword', 'melee', '1-Handed'), armour: item('Standard Armour', 'armour', 'Armour') };
const armoury = Object.values(A);
const faction = { name: 'Test', alignment: 'fallen' as const, variant: null };

describe('limits in packs', () => {
	const pack = `
faction: { id: heretic-legions, name: Heretic Legions, alignment: fallen }
rules:
  limits:
    - { name: Legionnaires, models: { upgrades: [Legionnaire] }, max: 1, per: { models: { entries: [Heretic Trooper], not: { upgrades: [Legionnaire] } } } }
  upgrades:
    - { name: Legionnaire, keyword: ELITE, keywords: [TOUGH], group: Rank, cost: 10, limits: [{ items: { categories: [ranged] }, max: 0 }] }
units:
  - name: Heretic Trooper
    category: troop
    cost: 20
    kit:
      limits: [{ items: { types: [2-Handed] }, max: 0 }]
      hands: { melee: 3 }
      loadouts: [[Greatsword], [Polearm, [Sword, Knife]]]
      counts_as: Trooper
armoury:
  - name: Hellblade
    category: melee
    type: 1-Handed
    cost: 10
    stipulations: { limits: [{ items: { categories: [shield] }, max: 0 }], limit_excludes: { entries: [Heretic Trooper] } }
`;
	it('read, written and read again unchanged', () => {
		const a = parseTemplate(pack, { factions: [{ id: 'heretic-legions', name: 'Heretic Legions' }] });
		expect(a.errors).toEqual([]);
		const b = parseTemplate(toTemplate(a.pack!), { factions: [{ id: 'heretic-legions', name: 'Heretic Legions' }] });
		expect(b.errors).toEqual([]);
		expect(b.pack!.rules.overrides).toEqual(a.pack!.rules.overrides);
		expect(b.pack!.units[0].kit).toEqual(a.pack!.units[0].kit);
		expect(b.pack!.items[0].stipulations).toEqual(a.pack!.items[0].stipulations);
		expect(a.pack!.units[0].kit?.countsAs).toBe('Trooper');
	});
	it('a misspelt key is refused, not ignored', () => {
		const { errors } = parseTemplate(pack.replace('max: 0 }], limit_excludes', 'maxx: 0 }], limit_excludes'));
		expect(errors.map((e) => e.path).join()).toMatch(/limits\[0\]\.maxx/);
		expect(parseTemplate(pack.replace('hands: {', 'handz: {')).errors.map((e) => e.path)).toContain('units[0].kit.handz');
	});
	it("a variant's limit of the same name replaces the faction's; others add up", () => {
		const r = readRules(null, null, [{ limits: [{ name: 'A', models: {}, max: 1 }, { models: {}, max: 9 }] }, { limits: [{ name: 'A', models: {}, max: 2 }] }]);
		expect(r.limits.map((l) => l.max)).toEqual([9, 2]);
	});
	it("the builder scopes each entry's, item's, upgrade's and Patron Skill's limits to their models", () => {
		const d: BuilderInput = {
			faction,
			rulesText: { faction: null, variant: null, overrides: [{ upgrades: [{ name: 'Legionnaire', keyword: null, max: null, cost: 0, currency: 'ducats', for: [], text: '', limits: [{ items: { categories: ['ranged'] }, max: 0 }] }] }] },
			profiles: [{ id: 't', name: 'Thrall', faction: 'x', variant: null, category: 'troop', availabilityMax: null, cost: 5, currency: 'ducats', keywords: [], stats: {}, battlekitNote: null, description: null, abilities: [], kit: { limits: [{ items: { categories: ['armour'] }, max: 0 }] } }],
			armoury,
			models: [
				{ id: 'a', type: 'Thrall', name: '', category: 'troop', status: 'active', profileId: 't', equipment: [], upgrades: [], cost: 5, currency: 'ducats', skills: [] },
				{ id: 'b', type: 'Heretic', name: '', category: 'troop', status: 'active', profileId: null, equipment: [], upgrades: ['Legionnaire'], cost: 5, currency: 'ducats', skills: ['Swift'] }
			],
			stash: [],
			ducats: 1000,
			glory: 0,
			unrestricted: false,
			openExploration: false,
			fireteams: [],
			patron: { name: 'P', skills: [{ name: 'Swift', limits: [{ items: { categories: ['melee'] }, max: 0 }] }] }
		};
		const { state } = builderState(d);
		const [thrall, heretic] = state.models;
		expect(equipCheck(thrall, A.armour, state).ok).toBe(false);
		expect(equipCheck(thrall, A.pistol, state).ok).toBe(true);
		expect(equipCheck(heretic, A.pistol, state).ok).toBe(false);
		expect(equipCheck(heretic, A.sword, state).ok).toBe(false);
		expect(equipCheck(heretic, A.armour, state).ok).toBe(true);
	});
});
