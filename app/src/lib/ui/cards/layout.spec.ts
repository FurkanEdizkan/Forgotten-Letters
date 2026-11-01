/** A fighter card's content and text fitting, with invented data and a fixed-width "font" (10 per character). */
import { describe, expect, it } from 'vitest';
import { m } from '#lib/messages';
import type { ApiFighter, ApiWarband } from '#lib/schemas/warbands';
import { cardData, clamp, initialsOf, shrink, wrap } from './layout';

const measure = (s: string) => s.length * 10;

const fighter = (over: Partial<ApiFighter> = {}) =>
	({
		id: 'f1',
		unitName: 'Warden',
		name: 'Brother Aldric Vane',
		status: 'active',
		xp: 4,
		xpMax: null,
		kit: [
			{ name: 'Hook Rifle', category: 'ranged', range: '24"' },
			{ name: 'Trench Club', category: 'melee', range: 'Melee' },
			{ name: 'Smoke Pot', category: 'equipment', range: null }
		],
		skills: [{ ref: 's', name: 'Steady Aim' }],
		injuries: [],
		keywords: [{ kw: 'kw:elite', name: 'Elite', derived: true }],
		stats: { movement: '6"', ranged: '+1 DICE', melee: '+2 DICE', armour: '-1', base: '32mm' },
		...over
	}) as unknown as ApiFighter;

const warband = (over: Partial<ApiWarband> = {}) =>
	({
		name: 'The Lantern Wardens',
		ownerName: 'Mira',
		factionName: 'Lantern Guild',
		variantName: null,
		dedicationName: null,
		seat: null,
		frame: null,
		...over
	}) as unknown as ApiWarband;

const t = m.warbands.cards.labels;

describe('cardData', () => {
	it('follows the reference: entry · warband · (player) · faction, then the profile and the lists', () => {
		const d = cardData(warband(), fighter(), t);
		expect(d.name).toBe('Brother Aldric Vane');
		expect(d.initials).toBe('BA');
		expect(d.subtitle).toBe('Warden · The Lantern Wardens · (Mira) · Lantern Guild');
		expect(d.stats.map((s) => s.value)).toEqual(['6"', '+1 DICE', '+2 DICE', '-1', '32mm']);
		expect(d.rows).toEqual([
			{ label: 'Experience', value: '4 XP' },
			{ label: 'Weapons', value: 'Hook Rifle (24") · Trench Club (Melee)' },
			{ label: 'Other kit', value: 'Smoke Pot' },
			{ label: 'Skills', value: 'Steady Aim' },
			{ label: 'Keywords', value: 'ELITE' }
		]);
		expect(d.footer).toBe('Forgotten Letters');
	});
	it('names the seat and campaign when seated, and the Sin over the faction', () => {
		const d = cardData(
			warband({
				dedicationName: 'Court of Greed',
				seat: {
					campaignId: 'c',
					campaignName: 'The Ashen Vigil',
					seatId: 's',
					seatName: 'The Ashen Gate',
					allowBeyondLimits: false
				}
			}),
			fighter({ name: null, xpMax: 7, status: 'unfit' }),
			t
		);
		expect(d.name).toBe('Warden');
		expect(d.subtitle).toBe(
			'Warden · The Lantern Wardens · The Ashen Gate (Mira) · Court of Greed'
		);
		expect(d.rows[0]).toEqual({ label: 'Experience', value: '4 of 7 XP · Status: Unfit for duty' });
		expect(d.footer).toBe('The Ashen Vigil · Forgotten Letters');
	});
	it('shows a dash for a stat the entry does not have', () => {
		const d = cardData(warband(), fighter({ stats: { movement: null } as ApiFighter['stats'] }), t);
		expect(d.stats[0]!.value).toBe('—');
	});
});

describe('text fitting', () => {
	it('wraps at the width, keeping an over-long word on its own line', () => {
		expect(wrap('aa bb cc', 50, measure)).toEqual(['aa bb', 'cc']);
		expect(wrap('abcdefghijkl x', 50, measure)).toEqual(['abcdefghijkl', 'x']);
		expect(wrap('', 50, measure)).toEqual([]);
	});
	it('cuts to n lines and ends the last with an ellipsis that fits', () => {
		expect(clamp(['aaaa', 'bbbb', 'cccc'], 2, 50, measure)).toEqual(['aaaa', 'bbbb…']);
		expect(clamp(['aaaa', 'bbbbbbb', 'c'], 2, 50, measure)).toEqual(['aaaa', 'bbbb…']);
		expect(clamp(['a'], 2, 50, measure)).toEqual(['a']);
	});
	it('shrinks to the largest size that fits, never below the floor', () => {
		expect(shrink(23, 15, (n) => n <= 18)).toBe(18);
		expect(shrink(23, 15, () => false)).toBe(15);
	});
	it('takes initials from the first two words', () => {
		expect(initialsOf('lantern  warden of ash')).toBe('LW');
	});
});
