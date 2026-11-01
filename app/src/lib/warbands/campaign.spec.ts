/** Sell value, refund window, next game's Threshold, advancement marks, promotion, keyword sources, statuses. */
import { describe, expect, it } from 'vitest';
import { rulesSet, type RulesSet } from '../rules/pack.ts';
import {
	advancementMarks,
	pieceValue,
	canRefund,
	keywordSources,
	nextGame,
	promotion,
	sellValue,
	xpMax
} from './campaign.ts';
import { buildModel, buildModels } from './model.ts';
import { rating } from './prices.ts';
import { resolveFaction } from './resolve.ts';
import { core, U, withRules } from './fixtures/core.ts';
import { elite, fighter, wb } from './fixtures/build.ts';
import { isActive } from './types.ts';

const threshold = {
	id: 'table:threshold',
	name: 'Threshold',
	kind: 'threshold' as const,
	rows: [
		{ roll: '1', name: 'Game 1', effects: { thresholdDucats: 700, fieldStrength: 10 } },
		{ roll: '2', name: 'Game 2', effects: { thresholdDucats: 800, fieldStrength: 11 } },
		{
			roll: '3+',
			name: 'Past the table',
			effects: { thresholdDucatsPerGame: 100, fieldStrengthPerGame: 1 }
		}
	]
};
const progression = {
	id: 'table:progression',
	name: 'Progression',
	kind: 'progression' as const,
	rows: [
		{ roll: '3', name: 'At 3', effects: { advancement: true } },
		{ roll: '1', name: 'At 1', effects: { advancement: true } },
		{ roll: '-', name: 'Promotion', effects: { maxElite: 6 } }
	]
};
const withTables = (over: Partial<RulesSet> = {}): RulesSet =>
	rulesSet.parse({ ...core, tables: [...core.tables, threshold, progression], ...over });

describe('selling and refunds', () => {
	it('sells for half, rounded up, in each currency', () => {
		expect(sellValue({ ducats: 15, glory: 3 })).toEqual({ ducats: 8, glory: 2 });
		expect(sellValue({ ducats: 0, glory: 1 })).toEqual({ ducats: 0, glory: 1 });
	});
	it('refunds in full only before the first game', () => {
		expect(canRefund(0)).toBe(true);
		expect(canRefund(1)).toBe(false);
	});
});

describe('what a bought piece is worth', () => {
	it('is what the warband would lose without it, so a discounted first copy refunds its discount price', () => {
		const f = resolveFaction(
			withRules({ prices: [{ first: true, factor: 0.5, items: { categories: ['melee'] } }] }),
			'faction:order'
		);
		const a = fighter(U('trooper'), { kit: ['line:order/greatsword'] });
		const one = wb([a]);
		const discounted = rating(one, f).ducats - 20;
		expect(discounted).toBeLessThan(12);
		expect(pieceValue(one, f, a.id, 'line:order/greatsword')).toEqual({
			ducats: discounted,
			glory: 0
		});
		// With a second copy on another fighter, taking the first away makes the second the discounted one.
		const b = fighter(U('trooper'), { kit: ['line:order/greatsword'] });
		const two = wb([a, b]);
		expect(pieceValue(two, f, a.id, 'line:order/greatsword').ducats).toBe(
			rating(two, f).ducats - rating(wb([{ ...a, kit: [] }, b]), f).ducats
		);
		expect(pieceValue(two, f, 'arsenal', 'line:order/greatsword')).toEqual({ ducats: 0, glory: 0 });
	});
});

describe('the next game', () => {
	it('reads the Threshold table, steps past it, and applies the variant modifier', () => {
		const set = withTables();
		const f = resolveFaction(set, 'faction:order');
		expect(nextGame(f, 0)).toEqual({ game: 1, threshold: 700, fieldStrength: 10 });
		expect(nextGame(f, 3)).toEqual({ game: 4, threshold: 1000, fieldStrength: 13 });
		const papal = resolveFaction(
			rulesSet.parse({
				...set,
				variants: set.variants.map((v) => ({
					...v,
					rules: { ...v.rules, thresholdModifier: -200 }
				}))
			}),
			'faction:order',
			'variant:order/pilgrims'
		);
		expect(nextGame(papal, 1)?.threshold).toBe(600);
	});
	it('is null without a Threshold table', () => {
		expect(nextGame(resolveFaction(core, 'faction:order'), 0)).toBeNull();
	});
	it('takes the advancement marks from the progression table, else the book defaults', () => {
		expect(advancementMarks(resolveFaction(withTables(), 'faction:order'))).toEqual([1, 3]);
		expect(advancementMarks(resolveFaction(core, 'faction:order'))).toEqual([2, 4, 7, 10]);
	});
});

describe('promotion and Experience', () => {
	const set = rulesSet.parse({
		...core,
		units: core.units.map((u) =>
			u.id === U('hound')
				? { ...u, promotion: 'never' }
				: u.id === U('brute')
					? { ...u, promotion: 'limited' }
					: u
		)
	});
	const f = resolveFaction(set, 'faction:order');
	it('refuses entries that can never be Promoted, Elites, and a seventh ELITE', () => {
		const trooper = fighter(U('trooper'));
		expect(promotion(wb([trooper]), f, trooper)).toBeNull();
		const hound = fighter(U('hound'));
		expect(promotion(wb([hound]), f, hound)).toMatch(/cannot be Promoted/);
		const sergeant = elite(U('sergeant'));
		expect(promotion(wb([sergeant]), f, sergeant)).toMatch(/already ELITE/);
		const six = Array.from({ length: 6 }, () => elite(U('sergeant')));
		expect(promotion(wb([...six, trooper]), f, trooper)).toMatch(/6 ELITE/);
	});
	it('caps Limited Potential at 7 Experience', () => {
		expect(xpMax(f.idx.units.get(U('brute')))).toBe(7);
		expect(xpMax(f.idx.units.get(U('trooper')))).toBeNull();
	});
});

describe('statuses', () => {
	const f = resolveFaction(core, 'faction:order');
	it('keeps active, missing and captured fighters on the roster; unfit, retired and dead leave it', () => {
		const on = ['active', 'misses_next', 'captured'] as const;
		const off = ['unfit', 'retired', 'dead'] as const;
		for (const s of on) expect(isActive({ group: 'troop', status: s })).toBe(true);
		for (const s of off) expect(isActive({ group: 'troop', status: s })).toBe(false);
		expect(isActive({ group: 'dead' })).toBe(false);
		const state = wb([fighter(U('trooper')), fighter(U('trooper'), { status: 'retired' })]);
		expect(buildModels(state, f)).toHaveLength(1);
		expect(rating(state, f).ducats).toBe(20);
	});
});

describe('keyword sources', () => {
	it('marks printed keywords, the grant, the fireteam and kit keywords, and leaves weapon keywords out', () => {
		const set = rulesSet.parse({
			...core,
			factions: core.factions.map((x) =>
				x.id === 'faction:order' ? { ...x, grant: [{ kw: 'kw:fear' }] } : x
			)
		});
		const f = resolveFaction(set, 'faction:order');
		const brute = fighter(U('brute'), { kit: ['line:order/lmg', 'line:order/lantern'] });
		const other = fighter(U('trooper'));
		const state = wb([brute, other], { fireteams: [[brute.id, other.id]] });
		const m = buildModel(state, f, brute)!;
		const ks = keywordSources(m, f);
		const by = (kw: string) => ks.find((k) => k.kw === kw);
		expect(by('kw:strong')).toMatchObject({ derived: false });
		expect(by('kw:fear')).toMatchObject({ derived: true, from: 'Order of Tests' });
		expect(by('kw:fireteam')).toMatchObject({ derived: true, from: 'Fireteam' });
		expect(by('kw:held')).toMatchObject({ derived: true, from: 'Lantern' });
		expect(by('kw:heavy')).toBeUndefined();
		// The grant is the model's keyword too, so limits and checks see it.
		expect(m.keywords.has('kw:fear')).toBe(true);
	});
});
