import { describe, expect, it } from 'vitest';
import { parseTemplate, templateText, toTemplate } from './faction-template';
import { itemFacts, readRules, unitKit } from './warband-rules';

const known = { factions: [{ id: 'new-antioch', name: 'The Principality of New Antioch' }] };

describe('faction template', () => {
	it('reads its own documented example and round-trips through export', () => {
		const a = parseTemplate(templateText([{ name: 'FEAR', kind: 'Tag' }]), known);
		expect(a.errors).toEqual([]);
		const p = a.pack!;
		expect(p.faction.id).toBe('carnival-of-saints');
		expect(p.units).toHaveLength(4);
		expect(p.items).toHaveLength(6);
		expect(p.rules.overrides?.caps).toEqual([{ name: '<Pilgrim Hound>', max: 2 }]);
		const b = parseTemplate(toTemplate(p), known);
		expect(b.errors).toEqual([]);
		expect(b.pack).toEqual(p);
	});

	it('files a variant under its parent', () => {
		const { pack, errors } = parseTemplate('faction: { name: Iron Saints, parent: new-antioch }\nunits: [{ name: Saint, category: elite, cost: 50 }]', known);
		expect(errors).toEqual([]);
		expect(pack!.faction.id).toBe('new-antioch--iron-saints');
		expect(pack!.units[0]).toMatchObject({ faction: 'new-antioch', variant: 'Iron Saints', id: 'new-antioch-iron-saints-saint' });
	});

	it('reports every mistake by path and reads nothing', () => {
		const { pack, errors } = parseTemplate(
			'faction: { name: X, alignment: neutral, parent: nowhere }\nunits: [{ name: A, category: boss, availability: lots }]\narmoury: [{ category: ranged, cost: -3 }]',
			known
		);
		expect(pack).toBeNull();
		expect(errors.map((e) => e.path)).toEqual(
			expect.arrayContaining(['faction.alignment', 'faction.parent', 'units[0].category', 'units[0].availability', 'armoury[0].name', 'armoury[0].cost'])
		);
		expect(parseTemplate('faction: [').errors[0].path).toBe('(file)');
	});

	it('every stipulation key reaches the builder', () => {
		const { pack } = parseTemplate(
			`faction: { name: T }
armoury:
  - { name: Gun, category: ranged, type: 2-Handed, stipulations: { only: [ELITE], per_model: 1, shield_combo: true, bayonet_lug: true, consumable: true, headgear: true, exploration_only: true } }`
		);
		const f = itemFacts({ ...pack!.items[0], restrictions: null });
		expect(f).toMatchObject({ only: ['ELITE'], perModel: 1, shieldCombo: true, bayonetLug: true, consumable: true, headgear: true, explorationOnly: true, hands: 2 });
	});
});

describe('overrides win over the book text', () => {
	it('variant rules', () => {
		const r = readRules('You have 700👑 to spend.', null, [{ startDucats: 500, caps: [{ name: 'Hound', max: 2 }] }, { leader: 'Master' }]);
		expect(r).toMatchObject({ startDucats: 500, caps: [{ name: 'Hound', max: 2 }], leader: 'Master' });
	});
	it('unit kit', () => {
		const k = unitKit('This model always has a Knife.', { fixed: ['Fangs'], nothingElse: true, hire: { alignment: 'faithful', by: [] } });
		expect(k.fixed).toEqual(['Fangs']);
		expect(k.nothingElse).toBe(true);
		expect(k).not.toHaveProperty('hire');
	});
	it('stipulations beat restrictions text', () => {
		const f = itemFacts({ name: 'Gun', category: 'ranged', cost: 1, currency: 'ducats', limit: null, restrictions: 'ELITE only, Bayonet Lug', type: '1-Handed', range: '12"', keywords: [], stipulations: { only: [], bayonetLug: false } });
		expect(f.only).toEqual([]);
		expect(f.bayonetLug).toBe(false);
	});
});
