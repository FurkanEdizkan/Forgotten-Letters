import { describe, expect, it } from 'vitest';
import {
	checkValues,
	defaultValues,
	describeValues,
	presetByKey,
	PRESETS
} from './house-rule-presets';
import { houseRule, houseRules } from './schemas/campaigns';

const trench = presetByKey('trench-depth')!;

describe('the preset catalogue', () => {
	it('has unique keys, and every preset accepts its own defaults', () => {
		expect(new Set(PRESETS.map((p) => p.key)).size).toBe(PRESETS.length);
		for (const p of PRESETS) expect(checkValues(p, defaultValues(p))).toEqual({});
	});

	it('refuses values out of range, of the wrong type or unknown', () => {
		expect(checkValues(trench, { depth: 5, wallAtDepthIsOpen: true })).toEqual({
			depth: 'Use 1 to 4 inches.'
		});
		expect(checkValues(trench, { depth: 2, wallAtDepthIsOpen: 'yes' })).toEqual({
			wallAtDepthIsOpen: 'Choose yes or no.'
		});
		expect(checkValues(trench, { depth: 2, wallAtDepthIsOpen: true, extra: 1 })).toEqual({
			extra: 'This preset has no such value.'
		});
	});

	it('describes values for players', () => {
		expect(describeValues(trench, { depth: 2, wallAtDepthIsOpen: false })).toBe(
			'Depth: 2″ · A wall at exactly that depth is open ground: no'
		);
	});
});

describe('houseRule schema', () => {
	const own = { name: 'Muddy boots', text: '', on: true };

	it('reads a rule saved before the library as the CM’s own, passive, without values', () => {
		expect(houseRule.parse(own)).toEqual({ ...own, kind: 'passive', preset: null, values: {} });
	});

	it('checks a preset rule against its fields, with the error on the value', () => {
		const r = houseRule.safeParse({
			name: 'Trench depth',
			on: true,
			kind: 'configuration',
			preset: 'trench-depth',
			values: { depth: 9, wallAtDepthIsOpen: true }
		});
		expect(r.success).toBe(false);
		expect(r.error?.issues[0]).toMatchObject({
			path: ['values', 'depth'],
			message: 'Use 1 to 4 inches.'
		});
	});

	it('refuses an own rule that claims to be a setting, and an unknown preset', () => {
		expect(houseRule.safeParse({ ...own, kind: 'configuration' }).success).toBe(false);
		expect(houseRule.safeParse({ ...own, preset: 'no-such' }).success).toBe(false);
	});

	it('refuses the same preset twice', () => {
		const t = {
			name: 'Trench depth',
			on: true,
			kind: 'configuration',
			preset: 'trench-depth',
			values: defaultValues(trench)
		};
		const r = houseRules.safeParse([t, t]);
		expect(r.success).toBe(false);
		expect(r.error?.issues[0]).toMatchObject({ path: [1, 'preset'] });
	});
});
