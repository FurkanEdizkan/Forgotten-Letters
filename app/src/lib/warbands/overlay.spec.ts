/**
 * The variant overlay and the armoury's sources against the invented sets, with the cases the generated rules
 * folders showed. Reused from archive/carcass-front-v1:app/src/lib/warband-rules.spec.ts (copy cases), rewritten
 * to ids and the rules folder format.
 */
import { describe, expect, it } from 'vitest';
import { canEquip, canRecruit, canUpgrade } from './checks.ts';
import { canCopy } from './copy.ts';
import { issues } from './issues.ts';
import { rating } from './prices.ts';
import { fromText } from './text.ts';
import { resolveFaction } from './resolve.ts';
import { core, U } from './fixtures/core.ts';
import { overlay } from './fixtures/overlay.ts';
import { elite, fighter, wb } from './fixtures/build.ts';
import type { Check, WarbandState } from './types.ts';

const base = resolveFaction(overlay, 'faction:order');
const v = resolveFaction(overlay, 'faction:order', 'variant:order/pilgrims');
const why = (c: Check) => (c.ok ? 'ok' : c.reasons.join(' | '));
const texts = (s: WarbandState, f = base) => issues(s, f).map((i) => i.text);
const PILGRIM = 'unit:order/pilgrims/pilgrim';
const lead = () => elite(U('captain'));
const inV = (fs: ReturnType<typeof fighter>[]) =>
	wb(fs, { variantId: 'variant:order/pilgrims', patronId: 'patron:saint' });

describe('the variant overlay', () => {
	it("a same-named faction limit is replaced by the variant's", () => {
		const hounds = (n: number) => Array.from({ length: n }, () => fighter(U('hound')));
		expect(texts(wb([lead(), ...hounds(3)]))).toEqual([]);
		expect(texts(wb([lead(), ...hounds(4)])).join()).toMatch(/At most 3 Hounds/);
		expect(texts(inV([lead(), ...hounds(2)]), v).join()).toMatch(/At most 1 Hound/);
		expect(v.rules.limits.filter((l) => l.name === 'Few Hounds')).toHaveLength(1);
	});

	it('adds an entry and an upgrade owned by another faction', () => {
		expect(v.units.some((u) => u.id === 'unit:legion/heretic')).toBe(true);
		expect(v.upgrades.some((u) => u.id === 'upgrade:legion/pact')).toBe(true);
		expect(canRecruit(inV([]), v, 'unit:legion/heretic').ok).toBe(true);
		expect(base.units.some((u) => u.id === 'unit:legion/heretic')).toBe(false);
	});

	it('a replacing entry stands in for the one it replaces: limits, caps and upgrade `for`', () => {
		const p = fighter(PILGRIM);
		expect(canUpgrade(inV([p]), v, p.id, 'upgrade:order/pilgrims/mole').ok).toBe(true);
		const moles = Array.from({ length: 3 }, () =>
			fighter(PILGRIM, { upgrades: ['upgrade:order/pilgrims/mole'] })
		);
		expect(texts(inV([lead(), ...moles]), v).join()).toMatch(/Two Moles at most/);
		const six = Array.from({ length: 6 }, () => fighter(PILGRIM));
		expect(texts(inV([lead(), ...six]), v)).toContain('6 Pilgrim: the limit is 5.');
		expect(why(canRecruit(inV(six.slice(1)), v, PILGRIM))).toMatch(/Limit reached \(5\/5\)/);
	});
});

describe('where kit comes from', () => {
	it("an exploration table's lines are every warband's, once the campaign master opens them", () => {
		const t = fighter(U('trooper'));
		expect(base.lines.some((l) => l.id === 'line:finds/lamp')).toBe(true);
		expect(why(canEquip(wb([t]), base, t.id, 'line:finds/lamp'))).toMatch(/Exploration discovery/);
		expect(canEquip(wb([t]), base, t.id, 'line:finds/lamp', { openExploration: true }).ok).toBe(
			true
		);
	});

	it('an item excluded by one of its lines is gone from every source', () => {
		expect(base.lines.filter((l) => l.item === 'item:scope').map((l) => l.id)).toEqual([
			'line:order/scope',
			'line:finds/scope'
		]);
		expect(v.lines.some((l) => l.item === 'item:scope')).toBe(false);
		const t = lead();
		expect(texts(inV([{ ...t, kit: ['line:order/scope'] }]), v).join()).toMatch(
			/Scope is excluded from this warband's armoury/
		);
	});

	it("a line's limits are for the models carrying the item from that line, not a Mercenary's own", () => {
		expect(texts(wb([lead(), fighter('unit:mercenaries/sellsword')]))).toEqual([]);
		expect(
			texts(wb([lead(), fighter(U('trooper'), { kit: ['line:order/teeth'] })])).join()
		).toMatch(/Faction Teeth need a Sword/);
	});
});

describe('copying a fighter', () => {
	const order = resolveFaction(core, 'faction:order');
	it('brings its upgrades and kit: their most, the line Limits and the price count it', () => {
		const guards = [1, 2].map(() => fighter(U('trooper'), { upgrades: ['upgrade:order/guard'] }));
		expect(why(canCopy(wb(guards), order, guards[0]!.id))).toMatch(/Guard: 2\/2 taken/);
		const bearer = elite(U('sergeant'), { kit: ['line:order/banner'] });
		expect(why(canCopy(wb([bearer]), order, bearer.id))).toMatch(/Banner: limit 1 reached/);
		const t = fighter(U('trooper'), { kit: ['line:order/rifle'], skills: ['skill:saint/melee'] });
		expect(canCopy(wb([t]), order, t.id).ok).toBe(true);
		expect(why(canCopy(wb([t], { stashDucats: 29 }), order, t.id))).toBe(
			'Costs 30 Ducats; 29 in the strongbox'
		);
		expect(why(canCopy(wb([elite(U('captain'))]), order, 'nobody'))).toMatch(/No fighter/);
	});
});

describe('the contract additions', () => {
	it('`any`: matches when any of its selectors does, and says so ("Guard or ELITE only")', () => {
		const t = fighter(U('trooper'));
		expect(why(canEquip(wb([t]), base, t.id, 'line:order/sash'))).toBe('Guard or ELITE only');
		const g = fighter(U('trooper'), { upgrades: ['upgrade:order/guard'] });
		expect(canEquip(wb([g]), base, g.id, 'line:order/sash').ok).toBe(true);
		const s = elite(U('sergeant'));
		expect(canEquip(wb([s]), base, s.id, 'line:order/sash').ok).toBe(true);
	});

	it('an upgrade marked afterRecruit may be bought later even under Q37 (a)', () => {
		const t = fighter(U('trooper'));
		expect(canUpgrade(wb([t]), base, t.id, 'upgrade:order/oath', { later: true }).ok).toBe(true);
		expect(canUpgrade(wb([t]), base, t.id, 'upgrade:order/guard', { later: true }).ok).toBe(false);
	});

	it('a faction that requires a variant reports a warband without one', () => {
		const court = resolveFaction(overlay, 'faction:court');
		const s = wb([fighter('unit:court/courtier')], {
			factionId: 'faction:court',
			dedication: 'wrath'
		});
		expect(texts(s, court)).toContain("The warband must be one of its faction's variants.");
	});
});

describe('kit is held as the line it was bought from', () => {
	it('the price is the line bought: a Mercenary pays its pool price, or the faction price for the faction line', () => {
		const pool = fighter('unit:mercenaries/sellsword', { kit: ['line:mercenaries/pistol'] });
		const bought = fighter('unit:mercenaries/sellsword', { kit: ['line:order/pistol'] });
		expect(rating(wb([pool]), base)).toEqual({ ducats: 0, glory: 2 });
		expect(rating(wb([bought]), base)).toEqual({ ducats: 5, glory: 2 });
		expect(
			why(canEquip(wb([pool], { stashDucats: 0 }), base, pool.id, 'line:order/knife'))
		).toMatch(/Costs 5 Ducats/);
	});

	it('an import takes the best line, matches aliases, and says where the choice was open', () => {
		const text = `X\nFaction: Order of Tests\nElites\nCaptain\n\nSarge\n• Battlekit: Great Sword/Axe, Lamp\n\nMercenaries\nSellsword\n• Battlekit: Pistol, Teeth\n\nStash\nKnife`;
		const r = fromText(text, overlay);
		expect(r.unmatched).toEqual([]);
		expect(r.state.fighters.map((x) => [x.unitId, x.kit])).toEqual([
			[U('captain'), []],
			[U('sergeant'), ['line:order/greatsword', 'line:glory-items/lamp']],
			['unit:mercenaries/sellsword', ['line:order/pistol']]
		]);
		expect(r.state.stash).toEqual(['line:order/knife']);
		expect(r.ambiguous).toEqual(['Sarge: Lamp from line:glory-items/lamp (also line:finds/lamp)']);
	});
});
