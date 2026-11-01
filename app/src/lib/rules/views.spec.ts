import { describe, expect, it } from 'vitest';
import { elementsOf } from './elements';
import { tiny } from './tiny.fixture';
import { battlekit, factions, factionView, variantView } from './views';

const els = elementsOf(tiny());

describe('compendium views', () => {
	it('names armoury lines after their item', () => {
		expect(els.find((e) => e.id === 'line:reeds/pole')!.name).toBe('Pole');
		expect(els.find((e) => e.id === 'skill:heron/still')!.data.patron).toBe('patron:heron');
	});
	it('lists every item with who may take it', () => {
		const kit = battlekit(els);
		expect(kit.map((k) => k.item.name)).toEqual(['Pole', 'Sling']);
		expect(kit[0]!.takenBy).toEqual([{ id: 'faction:reeds', name: 'Reed Folk' }]);
		expect(kit[1]!.takenBy).toEqual([]);
	});
	it('shows a faction with its variants, units, armoury, upgrades, mercenaries and Patrons', () => {
		expect(factions(els).map((f) => f.name)).toEqual(['Hired', 'Reed Folk']);
		const v = factionView(els, 'faction:reeds')!;
		expect(v.variants.map((x) => x.name)).toEqual(['Marsh']);
		expect(v.units.map((u) => u.name)).toEqual(['Chief', 'Poler']);
		expect(v.armoury).toEqual([
			{
				category: 'melee',
				rows: [expect.objectContaining({ item: expect.objectContaining({ name: 'Pole' }) })]
			}
		]);
		expect(v.upgrades.map((u) => u.name)).toEqual(['Scarred']);
		expect(v.mercenaries).toEqual([{ id: 'unit:hired/blade', name: 'Blade' }]);
		expect(v.patrons).toEqual([{ id: 'patron:heron', name: 'Heron' }]);
		expect(factionView(els, 'unit:reeds/chief')).toBeNull();
		expect(factionView(els, 'faction:none')).toBeNull();
	});
	it('shows a variant with what it replaces, adds and removes', () => {
		const v = variantView(els, 'variant:reeds/marsh')!;
		expect(v.faction).toEqual({ id: 'faction:reeds', name: 'Reed Folk' });
		expect(v.units.map((u) => u.name)).toEqual(['Wader']);
		expect(v.replaces).toEqual([
			{
				from: { id: 'unit:reeds/poler', name: 'Poler' },
				to: { id: 'unit:reeds/wader', name: 'Wader' }
			}
		]);
		expect(v.adds).toEqual([{ id: 'unit:hired/blade', name: 'Blade' }]);
		expect(v.excludes).toEqual([{ id: 'item:sling', name: 'Sling' }]);
		expect(variantView(els, 'faction:reeds')).toBeNull();
	});
});
