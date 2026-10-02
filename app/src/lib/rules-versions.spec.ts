import { describe, expect, it } from 'vitest';
import { affecting, diff, fieldChanges, stable, type Snapshot } from './rules-versions';

// Made-up rules in the books' shapes.
const empty = (): Snapshot => ({ units: {}, items: {}, factions: {}, patrons: {}, tables: {} });
const v1 = (): Snapshot => ({
	...empty(),
	units: {
		'na-yeoman': { name: 'Yeoman', faction: 'new-antioch', variant: null, cost: 30, keywords: ['NA'], abilities: [{ name: 'A', text: 'old' }] },
		'na-sniper': { name: 'Sniper', faction: 'new-antioch', variant: null, cost: 60 }
	},
	items: { 'na-rifle': { name: 'Rifle', faction: 'new-antioch', variant: null, cost: 10, limit: null, origin: 'book' } },
	factions: { 'new-antioch:': { name: 'new-antioch', faction: 'new-antioch', variant: null, overrides: { startDucats: 700 } } }
});

describe('rules versions', () => {
	it('compare equal rules as equal, whatever the key order', () => {
		expect(stable({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(stable({ a: [2, { c: 2, d: 1 }], b: 1 }));
		expect(diff(v1(), v1())).toEqual([]);
	});

	it('list what was added, removed and changed, field by field; text only as "text changed"', () => {
		const v2 = v1();
		v2.units['na-yeoman'] = { ...v2.units['na-yeoman'], cost: 35, abilities: [{ name: 'A', text: 'new' }] };
		delete v2.units['na-sniper'];
		v2.items['na-rifle'] = { ...v2.items['na-rifle'], limit: 2, origin: 'edited' };
		v2.items['na-pistol'] = { name: 'Pistol', faction: 'new-antioch', variant: null, cost: 6 };
		const d = diff(v1(), v2);
		expect(d.find((c) => c.id === 'na-yeoman')?.fields).toEqual([
			{ field: 'abilities', from: '', to: 'text changed' },
			{ field: 'cost', from: '30', to: '35' }
		]);
		expect(d.find((c) => c.id === 'na-sniper')?.change).toBe('removed');
		expect(d.find((c) => c.id === 'na-pistol')?.change).toBe('added');
		expect(d.find((c) => c.id === 'na-rifle')?.fields).toEqual([{ field: 'limit', from: '—', to: '2' }]);
	});

	it("split the changes into this warband's and the rest of its faction's", () => {
		const v2 = v1();
		v2.units['na-yeoman'].cost = 35;
		v2.units['na-sniper'].cost = 65;
		v2.items['na-rifle'].cost = 12;
		v2.factions['new-antioch:'].overrides = { startDucats: 650 };
		v2.units['hl-trooper'] = { name: 'Trooper', faction: 'heretic-legions', variant: null, cost: 20 };
		const { mine, faction } = affecting(diff(v1(), v2), { faction: 'new-antioch', variant: null, profileIds: ['na-yeoman'], entryNames: ['Yeoman'], itemNames: ['Rifle'], patron: null });
		expect(mine.map((c) => c.id).sort()).toEqual(['na-rifle', 'na-yeoman', 'new-antioch:']);
		expect(faction.map((c) => c.id)).toEqual(['na-sniper']);
	});
});

describe('changes inside settings', () => {
	it('name the setting that changed, and rules added or taken away by name', () => {
		const a = { kit: { hands: { melee: 6 }, limits: [{ text: 'Six weapons', max: 6 }] }, cost: 10 };
		const b = { kit: { hands: { melee: 6 }, heavyOneHand: 2, limits: [{ text: 'Six weapons', max: 6 }, { text: 'Two at most', max: 2 }] }, cost: 10 };
		expect(fieldChanges(a, b)).toEqual([
			{ field: 'kit heavyOneHand', from: '—', to: '2' },
			{ field: 'kit limits', from: '', to: '+ Two at most' }
		]);
	});
});
