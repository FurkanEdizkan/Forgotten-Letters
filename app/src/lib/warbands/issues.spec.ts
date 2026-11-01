/**
 * What makes a finished list illegal.
 * Reused from archive/carcass-front-v1:app/src/lib/warband-rules.spec.ts (warbandIssues), rewritten to ids and the rules folder format.
 */
import { describe, expect, it } from 'vitest';
import { issues } from './issues.ts';
import { resolveFaction } from './resolve.ts';
import { core, U } from './fixtures/core.ts';
import { elite, fighter, wb } from './fixtures/build.ts';
import type { Options, WarbandState } from './types.ts';

const order = resolveFaction(core, 'faction:order');
const pilgrims = resolveFaction(core, 'faction:order', 'variant:order/pilgrims');
const captain = () => elite(U('captain'));
const texts = (s: WarbandState, f = order, o?: Options) => issues(s, f, o).map((i) => i.text);

describe('a finished list', () => {
	it('a legal list has no issue', () => {
		expect(
			issues(
				wb([captain(), fighter(U('trooper'), { kit: ['line:order/rifle', 'line:order/knife'] })]),
				order
			)
		).toEqual([]);
	});

	it('must include its entries (availability min) and serve its forced Patron', () => {
		const t = texts(wb([fighter('unit:order/pilgrims/pilgrim')]), pilgrims);
		expect(t).toContain('The warband must include 1 Captain.');
		expect(t).toContain('The warband must serve Saint Tester, the Patient as its Patron.');
		expect(texts(wb([captain()], { patronId: 'patron:saint' }), pilgrims)).toEqual([]);
		expect(texts(wb([captain()], { patronId: 'patron:fiend' }), order)).toContain(
			'Fiend is not a Patron this warband may serve.'
		);
	});

	it('a Leader is capped by its availability, not by a count of LEADER keywords (Q43)', () => {
		expect(texts(wb([captain(), captain()])).join()).toMatch(/2 Captain: the limit is 1/);
		expect(texts(wb([captain(), captain()])).join()).not.toMatch(/Leaders/);
	});

	it('every recruit-time rule is asked again: excluded, not hired, caps, 6 ELITE, never recruited', () => {
		const t = texts(
			wb(
				[
					captain(),
					elite(U('knight'), { kit: ['line:order/mail'] }),
					elite(U('sergeant')),
					elite(U('sergeant'))
				],
				{ patronId: 'patron:saint' }
			),
			pilgrims
		);
		expect(t).toContain('It cannot include Knight.');
		expect(t).toContain('2 Sergeant: the limit is 1.');
		expect(texts(wb([captain(), fighter('unit:mercenaries/cutthroat')])).join()).toMatch(
			/Not hired by/
		);
		const seven = [captain(), ...Array.from({ length: 6 }, () => elite(U('sergeant')))];
		expect(texts(wb(seven)).join()).toMatch(/7 ELITE models; the most is 6/);
		expect(texts(wb([captain(), fighter(U('martyr'))])).join()).toMatch(/is not recruited/);
	});

	it("each fighter's kit goes on again piece by piece; fixed kit passes; loadouts must be whole", () => {
		expect(
			texts(
				wb([captain(), fighter(U('trooper'), { kit: ['line:order/lmg', 'line:order/mine'] })])
			).join()
		).toMatch(/Trooper with Mine: Only one piece of HEAVY/);
		expect(texts(wb([captain(), fighter(U('medic'))]))).toEqual([]);
		expect(
			texts(wb([captain(), fighter(U('medic'), { kit: ['line:order/plate'] })])).join()
		).toMatch(/cannot take Armour/);
		expect(
			texts(wb([captain(), fighter(U('mamluk'), { kit: ['line:order/polearm'] })])).join()
		).toMatch(/Mamluk: It must carry one of/);
		expect(
			texts(
				wb([captain(), fighter(U('mamluk'), { kit: ['line:order/pistol', 'line:order/knife'] })])
			)
		).toEqual([]);
		expect(
			texts(
				wb([
					captain(),
					elite(U('sergeant'), { kit: ['line:order/banner'] }),
					elite(U('sergeant'), { kit: ['line:order/banner'] })
				])
			).join()
		).toMatch(/2 × Banner: the limit is 1/);
		expect(
			texts(wb([captain(), fighter(U('trooper'), { kit: ['line:mercenaries/teeth'] })])).join()
		).toMatch(/Teeth is not in this warband's armoury/);
	});

	it('upgrades: for whom, how many, which exist', () => {
		const sgt = elite(U('sergeant'), { upgrades: ['upgrade:order/mole'] });
		expect(texts(wb([captain(), sgt])).join()).toMatch(
			/Trench Mole is only for Trooper \(Sergeant has it\)/
		);
		const moles = Array.from({ length: 4 }, () =>
			fighter(U('trooper'), { upgrades: ['upgrade:order/mole'] })
		);
		expect(texts(wb([captain(), ...moles]))).toContain('Trench Mole on 4 models; the most is 3.');
		expect(
			texts(wb([captain(), fighter(U('trooper'), { upgrades: ['upgrade:order/none'] })])).join()
		).toMatch(/no upgrade "upgrade:order\/none"/);
	});

	it('money: the ducat limit and the banks', () => {
		const t = texts(wb([captain()], { ducatLimit: 50, stashDucats: -10, unspentGlory: -3 }));
		expect(t).toContain('The fighters are worth 60 Ducats, over the limit of 50.');
		expect(t).toContain('The strongbox is 10 Ducats short.');
		expect(t).toContain('The strongbox is 3 Glory short.');
	});

	it('fireteams: within the faction’s number, of fighters on the table', () => {
		const a = fighter(U('trooper'));
		const b = fighter(U('trooper'));
		const c = fighter(U('trooper'));
		expect(texts(wb([captain(), a, b], { fireteams: [[a.id, b.id]] }))).toEqual([]);
		expect(
			texts(
				wb([captain(), a, b, c], {
					fireteams: [
						[a.id, b.id],
						[b.id, c.id]
					]
				})
			).join()
		).toMatch(/2 Fireteams; the most is 1/);
		expect(texts(wb([captain(), a], { fireteams: [[a.id, 'gone']] })).join()).toMatch(
			/not on the table/
		);
	});

	it('a dedication is chosen first (a warning until it is)', () => {
		const court = resolveFaction(core, 'faction:court');
		const s = wb([fighter('unit:court/courtier')], { factionId: 'faction:court' });
		expect(issues(s, court).find((i) => i.code === 'dedication')?.severity).toBe('warning');
		expect(issues({ ...s, dedication: 'wrath' }, court).some((i) => i.code === 'dedication')).toBe(
			false
		);
	});

	it('with allowBeyondLimits every issue is a warning', () => {
		const s = wb([fighter(U('trooper'))]);
		expect(issues(s, order).some((i) => i.severity === 'error')).toBe(true);
		expect(
			issues(s, order, { allowBeyondLimits: true }).every((i) => i.severity === 'warning')
		).toBe(true);
	});

	it('an unknown unit is reported, not dropped', () => {
		expect(
			issues(wb([captain(), fighter('unit:order/ghost')]), order).map((i) => i.code)
		).toContain('unknown-unit');
	});
});

describe('every refusal of the checks is also an issue of a finished list built without them', () => {
	const kit = (unit: string, ...items: string[]) =>
		wb([captain(), fighter(U(unit), { kit: items.map((i) => `line:order/${i}`) })]);
	const cases: [string, WarbandState, RegExp][] = [
		['hands', kit('trooper', 'rifle', 'pistol'), /No free hands for a ranged weapon/],
		['shield combo', kit('trooper', 'buckler', 'carbine'), /needs Shield Combo/],
		['grenade', kit('trooper', 'frag', 'smoke'), /Only one type of Grenade/],
		['armour', kit('trooper', 'plate', 'mail'), /Only one suit of Armour/],
		['headgear', kit('trooper', 'helm', 'hood'), /Only one piece of Headgear/],
		['held', kit('trooper', 'lantern', 'sword', 'pistol'), /HELD/],
		['bayonet', kit('trooper', 'bayonet'), /Bayonet Lug/],
		['only', kit('trooper', 'banner'), /ELITE only/],
		['per model', kit('trooper', 'charge', 'charge'), /1 per model/],
		['nothing else', kit('hound', 'knife'), /cannot have any other Battlekit/],
		['entry limit', kit('thrall', 'pistol'), /Only a Sword or Knife/],
		['exploration is fine once found', kit('trooper', 'map'), /^$/]
	];
	it.each(cases)('%s', (_, s, re) => {
		const t = texts(s).join('\n');
		if (re.source === '^$') expect(t).toBe('');
		else expect(t).toMatch(re);
	});
});
