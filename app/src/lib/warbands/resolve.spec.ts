/**
 * The effective faction: variant overlay, Patrons, Mercenaries, expansions.
 * Reused from archive/carcass-front-v1:app/src/lib/warband-rules.spec.ts (faction and variant rules) and
 * app/src/lib/patrons.spec.ts, rewritten to ids and the rules folder format.
 */
import { describe, expect, it } from 'vitest';
import { mergeSets, resolveFaction } from './resolve.ts';
import { core, expansion, U } from './fixtures/core.ts';

describe('the effective faction', () => {
	const base = resolveFaction(core, 'faction:order');
	const v = resolveFaction(core, 'faction:order', 'variant:order/pilgrims');

	it('a variant replaces an entry in place, adds its own and excludes some', () => {
		const ids = v.units.map((u) => u.id);
		expect(ids).toContain('unit:order/pilgrims/pilgrim');
		expect(ids).not.toContain(U('trooper'));
		expect(ids).not.toContain(U('knight'));
		expect(ids.indexOf('unit:order/pilgrims/pilgrim')).toBe(
			base.units.findIndex((u) => u.id === U('trooper'))
		);
		expect(v.lines.some((l) => l.item === 'item:flamer')).toBe(false);
		expect(base.lines.some((l) => l.item === 'item:flamer')).toBe(true);
	});

	it("the variant's rule keys replace the faction's; limits by name; caps by unit; exclusions add up", () => {
		expect(v.name).toBe('Pilgrim Band');
		expect(v.rules).toMatchObject({
			startDucats: 500,
			startGlory: 10,
			patron: 'patron:saint',
			freeItems: ['item:holy-relic']
		});
		expect(v.rules.caps).toEqual([{ unit: U('sergeant'), max: 1 }]);
		expect(v.rules.excluded).toEqual([U('knight'), 'item:flamer']);
		expect(v.rules.limits.map((l) => l.name)).toEqual(['Few Hounds']);
	});

	it('the Glory table and the upgrades the units list come along', () => {
		expect(base.lines.some((l) => l.id === 'line:glory-items/relic')).toBe(true);
		expect(base.upgrades.map((u) => u.id)).toEqual(
			expect.arrayContaining(['upgrade:order/guard', 'upgrade:order/hellfire'])
		);
	});

	it('Patrons by alignment; a forced Patron is the only one; a listed variant narrows its faction', () => {
		expect(base.patrons.map((p) => p.id)).toEqual(['patron:saint']);
		expect(v.patrons.map((p) => p.id)).toEqual(['patron:saint']);
		expect(resolveFaction(core, 'faction:legion').patrons.map((p) => p.id)).toEqual([
			'patron:fiend',
			'patron:gold'
		]);
		expect(resolveFaction(core, 'faction:court').patrons.map((p) => p.id)).toEqual([
			'patron:fiend'
		]);
	});

	it('an unknown faction or a variant of another faction is refused', () => {
		expect(() => resolveFaction(core, 'faction:nobody')).toThrow(/No faction/);
		expect(() => resolveFaction(core, 'faction:legion', 'variant:order/pilgrims')).toThrow(
			/No variant/
		);
	});
});

describe('an expansion over its base', () => {
	it('keeps the base, replaces by id, adds its own', () => {
		const merged = mergeSets({ ...expansion, base: core });
		expect(merged.manifest.id).toBe('test-exp');
		expect(merged.units.find((u) => u.id === U('trooper'))?.cost).toBe(22);
		expect(merged.units.filter((u) => u.id === U('trooper'))).toHaveLength(1);
		const f = resolveFaction({ ...expansion, base: core }, 'faction:order');
		expect(f.units.some((u) => u.id === U('scout'))).toBe(true);
		expect(f.lines.length).toBe(resolveFaction(core, 'faction:order').lines.length);
	});
});
