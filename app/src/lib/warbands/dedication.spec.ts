/**
 * A dedication that lays an overlay (the Court's Sin, review decision R2): the warband stores the key, the engine
 * lays the variant it names; a missing one is an error; an import maps the Sin's name to the dedication. Invented
 * data only.
 */
import { describe, expect, it } from 'vitest';
import { rulesSet, type RulesSet } from '../rules/pack.ts';
import { issues } from './issues.ts';
import { factionByName } from './match.ts';
import { resolveFaction } from './resolve.ts';
import { core } from './fixtures/core.ts';
import { fighter, wb } from './fixtures/build.ts';

const set: RulesSet = rulesSet.parse({
	...core,
	factions: core.factions.map((f) =>
		f.id === 'faction:court'
			? {
					...f,
					dedications: [
						{ key: 'greed', name: 'Greed', variant: 'variant:court/greed' },
						{ key: 'wrath', name: 'Wrath', variant: 'variant:court/wrath' }
					]
				}
			: f
	),
	variants: [
		...core.variants,
		{ id: 'variant:court/greed', faction: 'faction:court', name: 'Court of Greed' },
		{
			id: 'variant:court/wrath',
			faction: 'faction:court',
			name: 'Court of Wrath',
			rules: { thresholdModifier: -50 }
		}
	],
	units: [
		...core.units,
		{
			id: 'unit:court/greed/miser',
			owner: 'variant:court/greed',
			name: 'Miser',
			category: 'troop',
			availability: { min: 0, max: null },
			cost: 15,
			currency: 'ducats',
			stats: {},
			keywords: [],
			abilities: [],
			kit: {}
		}
	]
});

describe('a dedication with an overlay', () => {
	it('lays the variant it names; the warband keeps the dedication, not a variant', () => {
		const greed = resolveFaction(set, 'faction:court', undefined, 'greed');
		expect(greed.variant?.id).toBe('variant:court/greed');
		expect(greed.dedication).toBe('greed');
		expect(greed.name).toBe('Court of Stubs');
		expect(greed.units.map((u) => u.id)).toContain('unit:court/greed/miser');
		const wrath = resolveFaction(set, 'faction:court', undefined, 'wrath');
		expect(wrath.units.map((u) => u.id)).not.toContain('unit:court/greed/miser');
		expect(wrath.rules.thresholdModifier).toBe(-50);
	});
	it('cannot be taken with a variant as well', () => {
		expect(() => resolveFaction(set, 'faction:court', 'variant:court/greed', 'wrath')).toThrow(
			/cannot be taken with a variant/
		);
	});
	it('a warband without one is not finished (an error, not a warning)', () => {
		const f = resolveFaction(set, 'faction:court');
		const s = wb([fighter('unit:court/courtier')], { factionId: 'faction:court' });
		const i = issues(s, f).find((x) => x.code === 'dedication');
		expect(i).toMatchObject({ severity: 'error' });
		// Dedications without an overlay stay a warning.
		const plain = resolveFaction(core, 'faction:court');
		expect(issues(s, plain).find((x) => x.code === 'dedication')).toMatchObject({
			severity: 'warning'
		});
	});
	it('an import naming the Sin goes into the faction with that dedication', () => {
		expect(factionByName(set, 'Court of Greed')).toEqual({
			factionId: 'faction:court',
			variantId: undefined,
			dedication: 'greed'
		});
	});
});
