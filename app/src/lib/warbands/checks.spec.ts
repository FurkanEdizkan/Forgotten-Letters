/**
 * The recruit, equip, upgrade and stash checks against the invented set.
 * Reused from archive/carcass-front-v1:app/src/lib/warband-rules.spec.ts and warband-limits.spec.ts, rewritten to ids and the rules folder format.
 */
import { describe, expect, it } from 'vitest';
import {
	canEquip,
	canRecruit,
	canStash,
	canUpgrade,
	availableLines,
	availableUnits
} from './checks.ts';
import { resolveFaction } from './resolve.ts';
import { core, U, withRules } from './fixtures/core.ts';
import { elite, fighter, wb } from './fixtures/build.ts';
import type { Check, Fighter, WarbandState } from './types.ts';

const order = resolveFaction(core, 'faction:order');
const pilgrims = resolveFaction(core, 'faction:order', 'variant:order/pilgrims');
const why = (c: Check) => (c.ok ? 'ok' : c.reasons.join(' | '));
const L = (i: string) => `line:order/${i}`;
/** Can this fighter (with this kit) take that line, alone in the warband? */
const take = (x: Fighter, i: string, over: Partial<WarbandState> = {}, f = order) =>
	canEquip(wb([x], over), f, x.id, L(i));

describe('recruiting', () => {
	it('refuses excluded entries, entries over their cap, and never-recruited ones', () => {
		expect(why(canRecruit(wb([]), pilgrims, U('knight')))).toMatch(
			/Pilgrim Band cannot include Knight/
		);
		const one = wb([elite(U('sergeant'))]);
		expect(why(canRecruit(one, pilgrims, U('sergeant')))).toMatch(/Limit reached \(1\/1\)/);
		expect(canRecruit(one, order, U('sergeant')).ok).toBe(true);
		expect(why(canRecruit(wb([elite(U('captain'))]), order, U('captain')))).toMatch(
			/Limit reached/
		);
		expect(why(canRecruit(wb([]), order, U('martyr')))).toMatch(/is not recruited/);
		expect(why(canRecruit(wb([]), order, 'unit:order/pilgrims/pilgrim'))).toMatch(
			/not in the Order of Tests list/
		);
	});

	it('at most 6 ELITE models', () => {
		const six = Array.from({ length: 6 }, () => elite(U('knight'), { kit: ['line:order/mail'] }));
		expect(why(canRecruit(wb(six), order, U('sergeant')))).toMatch(/at most 6 ELITE/);
		expect(canRecruit(wb(six), order, U('trooper')).ok).toBe(true);
	});

	it('hires Mercenaries by alignment or by the factions they name', () => {
		expect(order.mercenaries.map((u) => u.id)).toEqual(['unit:mercenaries/sellsword']);
		expect(why(canRecruit(wb([]), order, 'unit:mercenaries/cutthroat'))).toMatch(
			/Not hired by Order of Tests/
		);
		const legion = resolveFaction(core, 'faction:legion');
		expect(
			canRecruit(wb([], { factionId: 'faction:legion' }), legion, 'unit:mercenaries/cutthroat').ok
		).toBe(true);
	});

	it('Glory needs Glory; Ducats come from the bank and stay within the ducat limit', () => {
		expect(why(canRecruit(wb([], { unspentGlory: 0 }), order, 'unit:mercenaries/sellsword'))).toBe(
			'Costs 2 Glory; 0 in the strongbox'
		);
		expect(why(canRecruit(wb([], { stashDucats: 50 }), order, U('captain')))).toBe(
			'Costs 60 Ducats; 50 in the strongbox'
		);
		expect(
			why(canRecruit(wb([fighter(U('trooper'))], { ducatLimit: 50 }), order, U('knight')))
		).toMatch(/Over the ducat limit \(100 of 50\)/);
	});

	it('lists every entry for the Add fighter dialog with its reasons', () => {
		const list = availableUnits(wb([]), pilgrims);
		expect(list.find((x) => x.unit.id === U('captain'))?.ok).toBe(true);
		expect(list.some((x) => x.unit.id === U('knight'))).toBe(false);
	});
});

describe('the Battlekit Limits', () => {
	it('two 1-handed or one 2-handed weapon of each kind', () => {
		expect(take(fighter(U('trooper'), { kit: ['line:order/pistol'] }), 'pistol').ok).toBe(true);
		expect(
			why(
				take(fighter(U('trooper'), { kit: ['line:order/pistol', 'line:order/pistol'] }), 'pistol')
			)
		).toMatch(/No free hands for a ranged/);
		expect(why(take(fighter(U('trooper'), { kit: ['line:order/rifle'] }), 'pistol'))).toMatch(
			/No free hands/
		);
		expect(why(take(fighter(U('trooper'), { kit: ['line:order/greatsword'] }), 'knife'))).toMatch(
			/No free hands for a melee weapon/
		);
	});

	it('STRONG holds a 2-handed weapon in one hand, unless CUMBERSOME', () => {
		expect(take(fighter(U('brute'), { kit: ['line:order/greatsword'] }), 'knife').ok).toBe(true);
		expect(take(fighter(U('brute'), { kit: ['line:order/pike'] }), 'knife').ok).toBe(false);
	});

	it('a shield takes a hand; 2-handed weapons only with Shield Combo on both', () => {
		expect(
			why(take(fighter(U('trooper'), { kit: ['line:order/buckler', 'line:order/sword'] }), 'knife'))
		).toMatch(/With a Shield/);
		expect(why(take(fighter(U('trooper'), { kit: ['line:order/buckler'] }), 'carbine'))).toMatch(
			/Shield Combo/
		);
		expect(take(fighter(U('trooper'), { kit: ['line:order/shield'] }), 'carbine').ok).toBe(true);
		expect(take(fighter(U('trooper'), { kit: ['line:order/shield'] }), 'rifle').ok).toBe(false);
	});

	it("an entry's own stipulations for an item: the Sipahi's Rifle has Shield Combo", () => {
		expect(take(fighter(U('sipahi'), { kit: ['line:order/shield'] }), 'rifle').ok).toBe(true);
	});

	it('three hands for melee: two 1-handed weapons beside a shield', () => {
		expect(
			take(fighter(U('homunculus'), { kit: ['line:order/shield', 'line:order/sword'] }), 'knife').ok
		).toBe(true);
		expect(
			take(
				fighter(U('homunculus'), {
					kit: ['line:order/shield', 'line:order/sword', 'line:order/knife']
				}),
				'sword'
			).ok
		).toBe(false);
		expect(
			take(fighter(U('trooper'), { kit: ['line:order/shield', 'line:order/sword'] }), 'knife').ok
		).toBe(false);
	});

	it('one grenade type, one armour, one shield, one headgear, no duplicate equipment', () => {
		expect(why(take(fighter(U('trooper'), { kit: ['line:order/frag'] }), 'smoke'))).toBe(
			'Only one type of Grenade'
		);
		expect(why(take(fighter(U('trooper'), { kit: ['line:order/plate'] }), 'mail'))).toBe(
			'Only one suit of Armour'
		);
		expect(why(take(fighter(U('trooper'), { kit: ['line:order/buckler'] }), 'shield'))).toBe(
			'Only one Shield'
		);
		expect(why(take(fighter(U('trooper'), { kit: ['line:order/helm'] }), 'hood'))).toBe(
			'Only one piece of Headgear'
		);
		expect(why(take(fighter(U('trooper'), { kit: ['line:order/medkit'] }), 'medkit'))).toMatch(
			/Already has Kit Bag/
		);
	});

	it('one piece of HEAVY kit unless STRONG; HELD kit leaves one hand', () => {
		expect(why(take(fighter(U('trooper'), { kit: ['line:order/lmg'] }), 'mine'))).toMatch(/HEAVY/);
		expect(take(fighter(U('brute'), { kit: ['line:order/lmg'] }), 'mine').ok).toBe(true);
		expect(
			why(
				take(fighter(U('trooper'), { kit: ['line:order/lantern', 'line:order/sword'] }), 'pistol')
			)
		).toMatch(/HELD/);
	});

	it('a bayonet needs a Bayonet Lug', () => {
		expect(why(take(fighter(U('trooper')), 'bayonet'))).toMatch(/Bayonet Lug/);
		expect(take(fighter(U('trooper'), { kit: ['line:order/rifle'] }), 'bayonet').ok).toBe(true);
	});
});

describe('armoury stipulations and entry rules', () => {
	it('"X only": ELITE only, Rifle only', () => {
		expect(why(take(fighter(U('trooper')), 'banner'))).toBe('ELITE only');
		expect(take(elite(U('sergeant')), 'banner').ok).toBe(true);
		expect(why(take(fighter(U('trooper')), 'scope'))).toBe('Rifle only');
		expect(take(fighter(U('trooper'), { kit: ['line:order/rifle'] }), 'scope').ok).toBe(true);
	});

	it('a Limit counts the warband and the stash; per-model limits too', () => {
		const a = elite(U('sergeant'), { kit: ['line:order/banner'] });
		const b = elite(U('sergeant'));
		expect(why(canEquip(wb([a, b]), order, b.id, L('banner')))).toBe('Limit 1/1 used');
		const c = fighter(U('trooper'));
		expect(
			why(
				canEquip(
					wb([c], { stash: ['line:order/charge', 'line:order/charge', 'line:order/charge'] }),
					order,
					c.id,
					L('charge')
				)
			)
		).toMatch(/Limit 3\/3/);
		expect(why(take(fighter(U('trooper'), { kit: ['line:order/charge'] }), 'charge'))).toMatch(
			/1 per model/
		);
	});

	it('Exploration-only kit waits for the campaign master', () => {
		const x = fighter(U('trooper'));
		expect(why(take(x, 'map'))).toMatch(/Exploration discovery/);
		expect(canEquip(wb([x]), order, x.id, L('map'), { openExploration: true }).ok).toBe(true);
	});

	it('"cannot have any other Battlekit" and "apart from Armour"', () => {
		expect(why(take(fighter(U('hound')), 'knife'))).toBe('A Hound cannot have any other Battlekit');
		expect(why(take(fighter(U('medic')), 'mail'))).toMatch(/A Medic cannot take Armour/);
	});

	it('an excluded item is not in the armoury', () => {
		const x = fighter(U('captain'));
		expect(why(canEquip(wb([x]), pilgrims, x.id, L('flamer')))).toBe(
			"Flamer is excluded from this warband's armoury"
		);
		expect(availableLines(wb([x]), pilgrims, x.id).some((l) => l.line.item === 'item:flamer')).toBe(
			false
		);
	});

	it('a loadout is carried whole or not at all', () => {
		expect(why(take(fighter(U('mamluk'), { kit: ['line:order/greatsword'] }), 'shield'))).toMatch(
			/Only one of/
		);
		expect(take(fighter(U('mamluk'), { kit: ['line:order/polearm'] }), 'shield').ok).toBe(true);
	});

	it('an entry may take only some kit (a max 0 limit refuses)', () => {
		expect(take(fighter(U('thrall')), 'knife').ok).toBe(true);
		expect(why(take(fighter(U('thrall')), 'pistol'))).toMatch(/Only a Sword or Knife/);
	});

	it('Glory-priced kit needs Glory', () => {
		const x = fighter(U('trooper'));
		expect(why(canEquip(wb([x], { unspentGlory: 1 }), order, x.id, 'line:glory-items/relic'))).toBe(
			'Costs 3 Glory; 1 in the strongbox'
		);
	});
});

describe('upgrades', () => {
	it('only for the entries named, within its most, in its own currency', () => {
		const t = fighter(U('trooper'));
		const s = elite(U('sergeant'));
		expect(canUpgrade(wb([t, s]), order, t.id, 'upgrade:order/mole').ok).toBe(true);
		expect(why(canUpgrade(wb([t, s]), order, s.id, 'upgrade:order/mole'))).toMatch(
			/Trench Mole is for Trooper/
		);
		const guards = [1, 2].map(() => fighter(U('trooper'), { upgrades: ['upgrade:order/guard'] }));
		expect(why(canUpgrade(wb([...guards, t]), order, t.id, 'upgrade:order/guard'))).toMatch(
			/Guard: 2\/2 taken/
		);
		expect(
			why(canUpgrade(wb([t], { unspentGlory: 1 }), order, t.id, 'upgrade:order/blessed'))
		).toMatch(/2 Glory/);
	});

	it('only at recruitment unless Q37 says otherwise', () => {
		const t = fighter(U('trooper'));
		expect(why(canUpgrade(wb([t]), order, t.id, 'upgrade:order/mole', { later: true }))).toMatch(
			/only when the fighter is recruited/
		);
		expect(
			canUpgrade(wb([t]), order, t.id, 'upgrade:order/mole', {
				later: true,
				switches: { q37: 'b' }
			}).ok
		).toBe(true);
	});

	it("an upgrade's limits: at most 2 Goetic Powers, no ranged weapons with Wrath of God", () => {
		const w = elite(U('warlock'), { upgrades: ['upgrade:order/hellfire', 'upgrade:order/dread'] });
		expect(why(canUpgrade(wb([w]), order, w.id, 'upgrade:order/speed'))).toMatch(
			/At most 2 Goetic Powers/
		);
		const t = fighter(U('trooper'), { kit: ['line:order/pistol'] });
		expect(why(canUpgrade(wb([t]), order, t.id, 'upgrade:order/wrath'))).toMatch(
			/no Ranged Weapons/
		);
		expect(why(canUpgrade(wb([t]), order, t.id, 'upgrade:order/none'))).toMatch(/no upgrade/);
	});
});

describe('the stash', () => {
	it('follows the line: exploration finds and Limits', () => {
		expect(why(canStash(wb([]), order, L('map')))).toMatch(/Exploration discovery/);
		expect(canStash(wb([]), order, L('map'), { openExploration: true }).ok).toBe(true);
		const held = elite(U('sergeant'), { kit: ['line:order/banner'] });
		expect(why(canStash(wb([held]), order, L('banner')))).toBe('Limit 1/1 used');
	});
});

describe('a warband-wide limit refuses the change that breaks it', () => {
	it('no ranged weapon dearer than 15 Ducats', () => {
		const f = resolveFaction(
			withRules({
				limits: [
					{
						text: 'No ranged weapon over 15 Ducats',
						items: { categories: ['ranged'], minCost: 16 },
						max: 0
					}
				]
			}),
			'faction:order'
		);
		const x = fighter(U('trooper'));
		expect(canEquip(wb([x]), f, x.id, L('pistol')).ok).toBe(true);
		expect(why(canEquip(wb([x]), f, x.id, L('flamer')))).toMatch(/No ranged weapon over 15 Ducats/);
	});
});
