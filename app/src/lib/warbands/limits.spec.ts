/**
 * Every limit shape (per, when, floors, options, weapon counts, injuries, Patron Skills).
 * Reused from archive/carcass-front-v1:app/src/lib/warband-limits.spec.ts, rewritten to ids and the rules folder format.
 */
import { describe, expect, it } from 'vitest';
import { canEquip, canRecruit, canUpgrade } from './checks.ts';
import { issues } from './issues.ts';
import { describeLimit } from './describe.ts';
import { resolveFaction } from './resolve.ts';
import { U, withRules } from './fixtures/core.ts';
import { elite, fighter, wb } from './fixtures/build.ts';
import type { Limit } from '../rules/pack.ts';
import type { Check, Options, WarbandState } from './types.ts';

const why = (c: Check) => (c.ok ? 'ok' : c.reasons.join(' | '));
const order = (...limits: Limit[]) => resolveFaction(withRules({ limits }), 'faction:order');
const texts = (s: WarbandState, f: ReturnType<typeof order>, o?: Options) =>
	issues(s, f, o).map((i) => i.text);

describe('limits: an action that newly breaks a max is refused; what a finished list needs is reported', () => {
	it('one Devil per two Troopers or part thereof (per, round up)', () => {
		const f = order({
			text: 'One Devil per two Troopers',
			models: { units: [U('devil')] },
			max: 1,
			per: { models: { units: [U('trooper')] }, each: 2, round: 'up' }
		});
		expect(why(canRecruit(wb([]), f, U('devil')))).toMatch(/One Devil per two Troopers/);
		expect(canRecruit(wb([fighter(U('trooper'))]), f, U('devil')).ok).toBe(true);
		const two = [fighter(U('trooper')), fighter(U('trooper')), fighter(U('devil'))];
		expect(canRecruit(wb(two), f, U('devil')).ok).toBe(false);
		expect(canRecruit(wb([...two, fighter(U('trooper'))]), f, U('devil')).ok).toBe(true);
	});

	it('"must be outnumbered by" is strict, and rounds down by default', () => {
		const f = order({
			models: { units: [U('wretch')] },
			max: 1,
			per: { models: { keywords: ['kw:demonic'] }, strict: true }
		});
		const devils = [fighter(U('devil')), fighter(U('devil'))];
		expect(canRecruit(wb(devils), f, U('wretch')).ok).toBe(true);
		expect(canRecruit(wb([...devils, fighter(U('wretch'))]), f, U('wretch')).ok).toBe(false);
	});

	it('"must be outnumbered by" is not broken by a warband with none of the outnumbered models', () => {
		const f = order({
			text: 'Wretches outnumbered',
			models: { units: [U('wretch')] },
			max: 1,
			per: { models: { keywords: ['kw:demonic'] }, strict: true }
		});
		const texts = (s: WarbandState) => issues(s, f).map((i) => i.text);
		expect(texts(wb([fighter(U('trooper'))]))).not.toContainEqual(
			expect.stringMatching(/Wretches outnumbered/)
		);
		expect(texts(wb([fighter(U('wretch'))]))).toContainEqual(
			expect.stringMatching(/Wretches outnumbered/)
		);
	});

	it('no more ranged weapons than melee weapons (per items, warband kit)', () => {
		const f = order({
			text: 'Not more ranged than melee',
			warbandItems: { categories: ['ranged'] },
			max: 1,
			per: { items: { categories: ['melee'] } }
		});
		const x = fighter(U('trooper'), { kit: ['line:order/sword'] });
		expect(canEquip(wb([x]), f, x.id, 'line:order/pistol').ok).toBe(true);
		const y = { ...x, kit: ['line:order/sword', 'line:order/pistol'] };
		expect(why(canEquip(wb([y]), f, y.id, 'line:order/pistol'))).toMatch(
			/Not more ranged than melee/
		);
	});

	it('at most 2 Knights while a Captain is present (when present), and one of two leads (entries min)', () => {
		const f = order(
			{ models: { units: [U('knight')] }, max: 2, when: { present: { units: [U('captain')] } } },
			{ text: 'A Captain or a Knight leads', entries: [U('captain'), U('knight')], min: 1 }
		);
		const three = [1, 2, 3].map(() => elite(U('knight'), { kit: ['line:order/mail'] }));
		expect(why(canRecruit(wb(three), f, U('captain')))).toMatch(/at most 2/);
		expect(texts(wb([fighter(U('trooper'))]), f)).toContain(
			'A Captain or a Knight leads (0, at least 1).'
		);
	});

	it('only while a Captain is present (when absent)', () => {
		const f = order({
			text: 'No Devils without a Captain',
			models: { units: [U('devil')] },
			max: 0,
			when: { absent: { units: [U('captain')] } }
		});
		expect(canRecruit(wb([elite(U('captain'))]), f, U('devil')).ok).toBe(true);
		expect(why(canRecruit(wb([]), f, U('devil')))).toMatch(/No Devils without a Captain/);
	});

	it('a third Mole once the other models total 1,000 Ducats (the Moles do not count)', () => {
		const f = order({
			models: { upgrades: ['upgrade:order/mole'] },
			max: 2,
			when: { ratingUnder: 1000 }
		});
		const moles = [1, 2].map(() => fighter(U('trooper'), { upgrades: ['upgrade:order/mole'] }));
		const third = fighter(U('trooper'));
		expect(canUpgrade(wb([...moles, third]), f, third.id, 'upgrade:order/mole').ok).toBe(false);
		const rich = Array.from({ length: 6 }, () =>
			elite(U('knight'), { kit: ['line:order/plate', 'line:order/lmg'] })
		);
		expect(canUpgrade(wb([...moles, third, ...rich]), f, third.id, 'upgrade:order/mole').ok).toBe(
			true
		);
		// Q39 (a): once on the roster, a rule that moves with the warband's worth is a warning.
		const list = issues(wb([...moles, { ...third, upgrades: ['upgrade:order/mole'] }]), f);
		expect(list.find((i) => i.code === 'limit')?.severity).toBe('warning');
		expect(
			issues(wb([...moles, { ...third, upgrades: ['upgrade:order/mole'] }]), f, {
				switches: { q39: 'b' }
			}).find((i) => i.code === 'limit')?.severity
		).toBe('error');
	});

	it('a value floor never blocks a recruit, and is reported (ratingMin works the other way)', () => {
		const f = order(
			{
				text: 'No model under 30 Ducats',
				models: { valueUnder: 30, not: { units: [U('wretch'), U('captain')] } },
				max: 0
			},
			{ text: 'Rich only', models: { units: [U('devil')] }, max: 0, when: { ratingMin: 100 } }
		);
		expect(canRecruit(wb([]), f, U('trooper')).ok).toBe(true);
		expect(texts(wb([fighter(U('trooper'))]), f)).toContain(
			'No model under 30 Ducats (1, at most 0).'
		);
		expect(
			texts(
				wb([fighter(U('trooper'), { kit: ['line:order/mail'] }), fighter(U('wretch'))]),
				f
			).join()
		).not.toMatch(/under 30/);
		expect(canRecruit(wb([elite(U('captain'))]), f, U('devil')).ok).toBe(true);
		expect(
			canRecruit(
				wb([elite(U('captain'), { kit: ['line:order/plate', 'line:order/greatsword'] })]),
				f,
				U('devil')
			).ok
		).toBe(false);
	});

	it('a campaign switch: a `when.option` limit applies only when the switch matches', () => {
		const f = order({
			text: 'Q40 strict',
			items: { items: ['item:relic'] },
			max: 0,
			when: { option: { key: 'q40', value: 'a' } }
		});
		const x = fighter(U('trooper'));
		expect(canEquip(wb([x]), f, x.id, 'line:glory-items/relic').ok).toBe(true);
		expect(
			why(canEquip(wb([x]), f, x.id, 'line:glory-items/relic', { switches: { q40: 'a' } }))
		).toMatch(/Q40 strict/);
		const d = order({
			text: 'Wrath only',
			models: { units: [U('devil')] },
			max: 0,
			when: { option: { key: 'dedication', value: 'greed' } }
		});
		expect(canRecruit(wb([], { dedication: 'greed' }), d, U('devil')).ok).toBe(false);
		expect(canRecruit(wb([], { dedication: 'wrath' }), d, U('devil')).ok).toBe(true);
	});

	it('an entry must carry armour: reported until it does', () => {
		const f = order();
		expect(texts(wb([elite(U('knight'))]), f)).toContain(
			'Must wear Armour: Knight (0, at least 1).'
		);
		expect(texts(wb([elite(U('knight'), { kit: ['line:order/mail'] })]), f).join()).not.toMatch(
			/Must wear/
		);
	});

	it('an Amalgam counts a 2-Handed weapon as two, but its first two HEAVY ones as one', () => {
		const f = order();
		const fine = elite(U('amalgam'), {
			kit: [
				'line:order/lmg',
				'line:order/flamer',
				'line:order/greatsword',
				'line:order/sword',
				'line:order/knife'
			]
		});
		expect(texts(wb([fine]), f).join()).not.toMatch(/Six weapons/);
		const over = elite(U('amalgam'), {
			kit: [
				'line:order/greatsword',
				'line:order/polearm',
				'line:order/sword',
				'line:order/knife',
				'line:order/pistol'
			]
		});
		expect(texts(wb([over]), f).join()).toMatch(/Six weapons/);
	});

	it("an injury's limits and a Patron Skill's limits are the model's", () => {
		const f = order();
		const hurt = fighter(U('trooper'), { injuries: ['table:trauma#1'] });
		expect(why(canEquip(wb([hurt]), f, hurt.id, 'line:order/mine'))).toMatch(/at most 0/);
		expect(canEquip(wb([hurt]), f, hurt.id, 'line:order/sword').ok).toBe(true);
		const skilled = [1, 2].map(() => fighter(U('trooper'), { skills: ['skill:saint/melee'] }));
		expect(texts(wb(skilled, { patronId: 'patron:saint' }), f).join()).toMatch(
			/Only one model may have Melee Procurement/
		);
	});

	it('says a limit in words when it has no text', () => {
		const f = order();
		expect(
			describeLimit(f, {
				models: { units: [U('devil')] },
				max: 1,
				per: { models: { units: [U('trooper')] }, each: 2, round: 'up' }
			})
		).toBe('The warband has at most 1 Devil for each 2 Trooper (a part counts).');
	});
});
