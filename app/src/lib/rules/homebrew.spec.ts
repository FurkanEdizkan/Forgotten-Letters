import { describe, expect, it } from 'vitest';
import { elementsOf } from './elements';
import {
	blankSet,
	checkHomebrew,
	copySet,
	filesOf,
	newId,
	remap,
	renamespace,
	setOfFiles,
	toggleLine,
	warningsOf
} from './homebrew';
import { tiny } from './tiny.fixture';

const base = tiny();
const baseIds = new Set(elementsOf(base).map((e) => e.id));

describe('homebrew sets', () => {
	it('a copy of a faction clones its units, lines and upgrades under new ids and keeps items', () => {
		const { set, kind } = copySet(elementsOf(base), 'faction:reeds', {
			name: 'Reed Kin',
			base: 'tiny-1.0',
			tag: '0a0b0c0d'
		});
		expect(kind).toBe('faction');
		const f = set.factions[0]!;
		expect(f).toMatchObject({
			id: 'faction:hb-0a0b0c0d/reeds',
			name: 'Reed Kin',
			leader: 'unit:hb-0a0b0c0d/reeds/chief',
			text: 'Led by [[unit:hb-0a0b0c0d/reeds/chief|a chief]].'
		});
		const chief = set.units.find((u) => u.name === 'Chief')!;
		expect(chief.owner).toBe(f.id);
		expect(chief.upgrades).toEqual(['upgrade:hb-0a0b0c0d/reeds/scarred']);
		expect(chief.kit.fixed).toEqual(['item:pole']);
		expect(chief.kit.countsAs).toBe('unit:hb-0a0b0c0d/reeds/poler');
		expect(set.armouryLines[0]!.stipulations?.only?.units).toEqual([chief.id]);
		// The variant's own unit is not part of the faction's copy.
		expect(set.units.map((u) => u.name)).toEqual(['Chief', 'Poler']);
		expect(checkHomebrew(set, baseIds)).toEqual({ ok: true, problems: [] });
	});

	it('a copy of a variant keeps its faction and clones what the variant owns', () => {
		const { set, kind } = copySet(elementsOf(base), 'variant:reeds/marsh', {
			name: 'Deep Marsh',
			base: 'tiny-1.0',
			tag: '11112222'
		});
		expect(kind).toBe('variant');
		expect(set.variants[0]).toMatchObject({
			faction: 'faction:reeds',
			replaces: [{ from: 'unit:reeds/poler', to: 'unit:hb-11112222/reeds/wader' }]
		});
		expect(checkHomebrew(set, baseIds).ok).toBe(true);
	});

	it('a blank faction is valid; an unresolved keyword and an id outside the namespace are problems', () => {
		const set = blankSet({ kind: 'faction', name: 'Ash Crows', base: 'tiny-1.0', tag: 'abcd0123' });
		expect(set.factions[0]!.id).toBe('faction:hb-abcd0123/ash-crows');
		expect(checkHomebrew(set, baseIds).ok).toBe(true);
		set.items.push({
			id: 'item:spear',
			name: 'Spear',
			category: 'melee',
			type: '2-Handed',
			keywords: [{ kw: 'kw:nowhere' }]
		});
		const { ok, problems } = checkHomebrew(set, baseIds);
		expect(ok).toBe(false);
		expect(problems.map((p) => p.message).join(' ')).toMatch(/kw:nowhere does not resolve/);
		expect(problems.map((p) => p.message).join(' ')).toMatch(/start with item:hb-abcd0123\//);
	});

	it('files round-trip, and an import gets a namespace of its own', () => {
		const { set } = copySet(elementsOf(base), 'faction:reeds', {
			name: 'Reed Kin',
			base: 'tiny-1.0',
			tag: '0a0b0c0d'
		});
		const files = filesOf(set);
		expect(Object.keys(files)).toContain('units.json');
		expect(files).not.toHaveProperty('tables.json');
		const back = renamespace(setOfFiles(files), 'ffff0000', 'Again', 'tiny-1.0');
		expect(JSON.stringify(back)).not.toContain('hb-0a0b0c0d');
		expect(back.manifest).toMatchObject({ id: 'hb-ffff0000', base: 'tiny-1.0', name: 'Again' });
		expect(checkHomebrew(back, baseIds).ok).toBe(true);
	});

	it('remaps keys and links; new ids never repeat', () => {
		const map = new Map([['item:a', 'item:b']]);
		expect(remap({ 'item:a': ['item:a', 'see [[item:a|it]]'] }, map)).toEqual({
			'item:b': ['item:b', 'see [[item:b|it]]']
		});
		expect(newId('unit', 'hb-1', 'Warden', new Set(['unit:hb-1/warden']))).toBe(
			'unit:hb-1/warden-2'
		);
	});

	it('toggling a unit off an open line limits it to the others; back on opens it again', () => {
		const line = {
			id: 'line:x',
			owner: 'faction:x',
			item: 'item:a',
			cost: 1,
			currency: 'ducats' as const
		};
		const off = toggleLine(line, 'unit:a', ['unit:a', 'unit:b']);
		expect(off.stipulations?.only?.units).toEqual(['unit:b']);
		expect(toggleLine(off, 'unit:a', ['unit:a', 'unit:b'])).toEqual(line);
	});

	it('warns when no unit can carry anything', () => {
		const set = blankSet({ kind: 'faction', name: 'Bare', base: 'tiny-1.0', tag: '12345678' });
		expect(warningsOf(set)).toEqual([]);
		set.units.push({ ...base.units[1]!, id: 'unit:hb-12345678/bare/x', kit: {} });
		expect(warningsOf(set)).toHaveLength(1);
	});
});
