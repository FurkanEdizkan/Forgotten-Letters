import { describe, expect, it } from 'vitest';
import { copyCheck, entryPrice, equipCheck, stashCheck, priceFor, readRules, recruitCheck, upgradeCheck, warbandIssues, type ArmouryItem, type EntryRef, type ModelState, type Upgrade, type WarbandState } from './warband-rules';
import type { ScopedLimit } from './warband-limits';

// Made-up kit and entries in the books' shapes (no book text lives in the repository).
const item = (name: string, category: ArmouryItem['category'], type: string, cost = 10, keywords: string[] = []): ArmouryItem => ({
	name,
	category,
	cost,
	currency: 'ducats',
	limit: null,
	restrictions: null,
	type,
	range: null,
	keywords
});
const A = {
	greatsword: item('Greatsword', 'melee', '2-Handed', 12),
	polearm: { ...item('Polearm', 'melee', '2-Handed', 10), restrictions: 'Shield Combo' },
	trenchShield: { ...item('Trench Shield', 'shield', 'Shield', 10), restrictions: 'Shield Combo' },
	pistol: item('Pistol', 'ranged', '1-Handed', 6),
	sword: item('Sword', 'melee', '1-Handed', 4),
	knife: item('Knife', 'melee', '1-Handed', 2),
	armour: item('Standard Armour', 'armour', 'Armour', 15),
	lmg: item('Machine Gun', 'ranged', '2-Handed', 60, ['HEAVY']),
	flamer: item('Flamer', 'ranged', '2-Handed', 30, ['HEAVY']),
	mine: item('Mine', 'grenade', 'Grenade', 20, ['HEAVY'])
};
const armoury = Object.values(A);
const held = (...xs: ArmouryItem[]) => xs.map((x) => ({ name: x.name, cost: x.cost, currency: x.currency }));
let n = 0;
const model = (type: string, over: Partial<ModelState> = {}): ModelState => ({
	id: `m${n++}`,
	type,
	category: 'troop',
	keywords: [],
	status: 'active',
	equipment: [],
	upgrades: [],
	kit: { fixed: [], swap: null, except: [], nothingElse: false },
	cost: 20,
	currency: 'ducats',
	skills: [],
	...over
});
const wb = (models: ModelState[], limits: ScopedLimit[] = [], over: Partial<WarbandState> = {}): WarbandState => ({
	models,
	stash: [],
	ducats: 10_000,
	glory: 100,
	armoury,
	unrestricted: false,
	limits,
	...over
});
const entry = (name: string, over: Partial<EntryRef> = {}): EntryRef => ({ name, category: 'troop', availabilityMax: null, cost: 20, currency: 'ducats', keywords: [], ...over });
const faction = { name: 'Test', alignment: 'fallen' as const, variant: null };
const rules = readRules(null);
const reason = (c: { ok: boolean; reason?: string }) => (c.ok ? 'ok' : c.reason);

describe('limits: what an action newly breaks is refused; what a finished list needs is reported', () => {
	it('a cost floor ("no model under 80 Ducats, except Wretched") never blocks a recruit, and is reported', () => {
		const floor: ScopedLimit = { text: 'No model under 80 Ducats', models: { value_under: 80, not: { entries: ['Wretched'] } }, max: 0 };
		expect(recruitCheck(entry('Praetor'), wb([], [floor]), rules, faction).ok).toBe(true);
		expect(warbandIssues(wb([model('Praetor', { cost: 60 })], [floor]), rules, [])).toContain('No model under 80 Ducats (1, at most 0).');
		expect(warbandIssues(wb([model('Praetor', { cost: 60, equipment: held(A.armour, A.greatsword) }), model('Wretched')], [floor]), rules, [])).toEqual([]);
	});

	it('one Castigator per two Communicants or part thereof', () => {
		const ratio: ScopedLimit = { text: 'One Castigator per two Communicants', models: { entries: ['Castigator'] }, max: 1, per: { models: { entries: ['Communicant'] }, each: 2, round: 'up' } };
		expect(reason(recruitCheck(entry('Castigator'), wb([], [ratio]), rules, faction))).toMatch(/One Castigator per two Communicants/);
		const one = [model('Communicant')];
		expect(recruitCheck(entry('Castigator'), wb(one, [ratio]), rules, faction).ok).toBe(true);
		const two = [model('Communicant'), model('Communicant'), model('Castigator')];
		expect(recruitCheck(entry('Castigator'), wb(two, [ratio]), rules, faction).ok).toBe(false);
		expect(recruitCheck(entry('Castigator'), wb([...two, model('Communicant')], [ratio]), rules, faction).ok).toBe(true);
	});

	it('"must be outnumbered by" is strict', () => {
		const fewer: ScopedLimit = { models: { entries: ['Wretched'] }, max: 1, per: { models: { keywords: ['DEMONIC'] }, strict: true } };
		const demons = [model('Hell Knight', { keywords: ['DEMONIC'] }), model('Hell Knight', { keywords: ['DEMONIC'] })];
		expect(recruitCheck(entry('Wretched'), wb(demons, [fewer]), rules, faction).ok).toBe(true);
		expect(recruitCheck(entry('Wretched'), wb([...demons, model('Wretched')], [fewer]), rules, faction).ok).toBe(false);
	});

	it('at most 2 Goetic Powers on a Praetor (an upgrade group), counted per model', () => {
		const powers: Upgrade[] = ['Hellfire', 'Dread', 'Unholy Speed'].map((name) => ({ name, keyword: null, max: null, cost: 5, currency: 'ducats', for: [], text: '', group: 'Goetic Power' }));
		const cap: ScopedLimit = { upgrades: ['Goetic Power'], max: 2, scope: { entries: ['Praetor'] } };
		const p = model('Praetor', { upgrades: ['Hellfire', 'Dread'] });
		const w = wb([p], [cap], { upgrades: powers });
		expect(reason(upgradeCheck(p, powers[2], w))).toMatch(/at most 2/);
		expect(upgradeCheck(model('Sorcerer', { upgrades: ['Hellfire', 'Dread'] }), powers[2], wb([], [cap], { upgrades: powers })).ok).toBe(true);
	});

	it('at most 2 Plague Knights with a Lord of Tumours (3 without), and one of the two leads', () => {
		const withLord: ScopedLimit = { models: { entries: ['Plague Knight'] }, max: 2, when: { present: { entries: ['Lord of Tumours'] } } };
		const leads: ScopedLimit = { text: 'A Lord of Tumours or a Plague Knight leads', entries: ['Lord of Tumours', 'Plague Knight'], min: 1 };
		const three = [model('Plague Knight'), model('Plague Knight'), model('Plague Knight')];
		expect(reason(recruitCheck(entry('Lord of Tumours'), wb(three, [withLord]), rules, faction))).toMatch(/at most 2/);
		expect(warbandIssues(wb(three, [withLord, leads]), rules, [])).toEqual([]);
		expect(warbandIssues(wb([model('Ghoul')], [withLord, leads]), rules, [])).toContain('A Lord of Tumours or a Plague Knight leads (0, at least 1).');
	});

	it('a third Trench Mole once the other models total 1,000 Ducats', () => {
		const moles: ScopedLimit = { models: { upgrades: ['Trench Moles'] }, max: 2, when: { rating_under: 1000 } };
		const mole: Upgrade = { name: 'Trench Moles', keyword: 'INFILTRATOR', max: 3, cost: 10, currency: 'ducats', for: [], text: '' };
		const two = [model('Trooper', { upgrades: ['Trench Moles'] }), model('Trooper', { upgrades: ['Trench Moles'] })];
		const third = model('Trooper', { cost: 900 });
		expect(upgradeCheck(third, mole, wb([...two, third], [moles], { upgrades: [mole] })).ok).toBe(false);
		// The Moles themselves don't count towards the 1,000.
		expect(upgradeCheck(third, mole, wb([...two, third, model('Lieutenant', { cost: 100 })], [moles], { upgrades: [mole] })).ok).toBe(false);
		const rich = model('Lieutenant', { cost: 1000 });
		expect(upgradeCheck(third, mole, wb([...two, third, rich], [moles], { upgrades: [mole] })).ok).toBe(true);
	});

	it('an entry that may take only some kit, and one that must carry armour (reported until it does)', () => {
		const only: ScopedLimit = { text: 'Only a Sword or Knife', items: { not: { names: ['Sword', 'Knife'] } }, max: 0, scope: { entries: ['Thrall'] } };
		const armoured: ScopedLimit = { text: 'Must wear Armour', items: { categories: ['armour'] }, min: 1, scope: { entries: ['Knight'] } };
		const t = model('Thrall');
		expect(equipCheck(t, A.knife, wb([t], [only])).ok).toBe(true);
		expect(reason(equipCheck(t, A.pistol, wb([t], [only])))).toMatch(/Only a Sword or Knife/);
		const k = model('Knight');
		expect(equipCheck(k, A.sword, wb([k], [armoured])).ok).toBe(true);
		expect(warbandIssues(wb([k], [armoured]), rules, [])).toContain('Must wear Armour: Knight (0, at least 1).');
	});

	it('no ranged weapon dearer than 15 Ducats, warband-wide', () => {
		const cheap: ScopedLimit = { text: 'No ranged weapon over 15 Ducats', items: { categories: ['ranged'], min_cost: 16 }, max: 0 };
		const m = model('Knight');
		expect(equipCheck(m, A.pistol, wb([m], [cheap])).ok).toBe(true);
		expect(equipCheck(m, A.flamer, wb([m], [cheap])).ok).toBe(false);
	});
});

describe('hands, loadouts and the Rulebook keywords', () => {
	it('a Mamluk carries a Greatsword, or a Polearm and a Trench Shield, or a Pistol and a Sword or Knife', () => {
		const kit = { fixed: [], swap: null, except: [], nothingElse: false, loadouts: [['Greatsword'], ['Polearm', 'Trench Shield'], ['Pistol', ['Sword', 'Knife']]] };
		const m = model('Mamluk', { kit, equipment: held(A.greatsword) });
		expect(reason(equipCheck(m, A.trenchShield, wb([m])))).toMatch(/Only one of/);
		const p = model('Mamluk', { kit, equipment: held(A.polearm) });
		expect(equipCheck(p, A.trenchShield, wb([p])).ok).toBe(true);
		expect(warbandIssues(wb([p]), rules, []).join()).toMatch(/must carry one of/);
		expect(warbandIssues(wb([model('Mamluk', { kit, equipment: held(A.pistol, A.knife) })]), rules, [])).toEqual([]);
	});

	it('an extra arm: three 1-handed melee weapons', () => {
		const kit = { fixed: [], swap: null, except: [], nothingElse: false, hands: { melee: 3 } };
		const m = model('Desecrated Saint', { kit, equipment: held(A.sword, A.knife) });
		expect(equipCheck(m, A.sword, wb([m])).ok).toBe(true);
		expect(equipCheck({ ...m, kit: { ...kit, hands: undefined } }, A.sword, wb([m])).ok).toBe(false);
	});

	it('2-Handed is not 1-Handed (the digit counts)', () => {
		const one: ScopedLimit = { text: 'No 2-Handed weapons', items: { types: ['2-Handed'] }, max: 0 };
		const m = model('Trooper');
		expect(equipCheck(m, A.sword, wb([m], [one])).ok).toBe(true);
		expect(equipCheck(m, A.greatsword, wb([m], [one])).ok).toBe(false);
	});

	it("an entry's own item facts: its Jezzail has Shield Combo", () => {
		const jezzail = item('Jezzail', 'ranged', '2-Handed', 20);
		const shield = { ...A.trenchShield };
		const kit = { fixed: [], swap: null, except: [], nothingElse: false, items: { Jezzail: { shieldCombo: true } } };
		const m = model('Sipahi', { kit, equipment: held(shield) });
		const w = wb([m], [], { armoury: [...armoury, jezzail] });
		expect(equipCheck(m, jezzail, w).ok).toBe(true);
		expect(equipCheck({ ...m, kit: { ...kit, items: undefined } }, jezzail, w).ok).toBe(false);
	});

	it('a shield takes one of three hands: two 1-handed melee weapons beside it', () => {
		const kit = { fixed: [], swap: null, except: [], nothingElse: false, hands: { melee: 3 } };
		const m = model('Homunculus', { kit, equipment: held(A.trenchShield, A.sword) });
		expect(equipCheck(m, A.knife, wb([m])).ok).toBe(true);
		expect(equipCheck({ ...m, equipment: held(A.trenchShield, A.sword, A.knife) }, A.sword, wb([m])).ok).toBe(false);
		expect(equipCheck({ ...m, kit: { ...kit, hands: undefined } }, A.knife, wb([m])).ok).toBe(false);
	});

	it('one piece of HEAVY battlekit, unless STRONG; an imported list is checked too', () => {
		const m = model('Trooper', { equipment: held(A.lmg) });
		expect(reason(equipCheck(m, A.mine, wb([m])))).toMatch(/HEAVY/);
		expect(equipCheck({ ...m, keywords: ['STRONG'] }, A.mine, wb([m])).ok).toBe(true);
		expect(warbandIssues(wb([model('Trooper', { equipment: held(A.lmg, A.mine) })]), rules, []).join()).toMatch(/HEAVY/);
	});
});

describe('the Patron a warband must serve', () => {
	it('is reported until it serves it', () => {
		const r = readRules(null, null, [{ patron: 'Mammon' }]);
		expect(warbandIssues(wb([model('Knight')]), r, [])).toContain('The warband must serve Mammon as its Patron.');
		expect(warbandIssues(wb([model('Knight')], [], { patron: 'Mammon, the Golden Lord' }), r, [])).toEqual([]);
	});
});

describe('prices by rule', () => {
	it('the first copy of each melee weapon at half price; a Patron Skill takes 5 off armour of 15 or more', () => {
		const m = model('Knight', { skills: ['Armour Procurement'] });
		const w = wb([m], [], {
			prices: [
				{ items: { categories: ['melee'] }, first: true, factor: 0.5 },
				{ items: { categories: ['armour'], min_cost: 15 }, less: 5, who: { skills: ['Armour Procurement'] } }
			]
		});
		expect(priceFor(m, A.greatsword, w).cost).toBe(6);
		expect(priceFor(m, A.greatsword, { ...w, stash: held(A.greatsword) }).cost).toBe(12);
		expect(priceFor(m, A.armour, w).cost).toBe(10);
		expect(priceFor(model('Squire'), A.armour, w).cost).toBe(15);
	});
	it('a Procurement Skill discounts every purchase while its model is in the warband', () => {
		const rule = { items: { categories: ['armour' as const] }, less: 5, while: { skills: ['Procurement'] } };
		const squire = model('Squire');
		expect(priceFor(squire, A.armour, wb([squire, model('Lord', { skills: ['Procurement'] })], [], { prices: [rule] })).cost).toBe(10);
		expect(priceFor(squire, A.armour, wb([squire], [], { prices: [rule] })).cost).toBe(15);
	});
	it('the first Goetic Warlock costs 110 Ducats instead of its Glory', () => {
		const w = wb([], [], { prices: [{ entries: ['Goetic Warlock'], first: true, cost: 110, currency: 'ducats' }] });
		const e = entry('Goetic Warlock', { cost: 3, currency: 'glory' });
		expect(entryPrice(e, w)).toMatchObject({ cost: 110, currency: 'ducats' });
		expect(entryPrice(e, { ...w, models: [model('Goetic Warlock')] })).toMatchObject({ cost: 3, currency: 'glory' });
	});
});

describe('the arsenal and copies follow the same rules', () => {
	it('an exploration find, or kit over its Limit, cannot be bought into the arsenal', () => {
		const found = { ...A.knife, name: 'Relic', restrictions: 'Exploration only' };
		expect(reason(stashCheck(found, wb([])))).toMatch(/Exploration only/);
		expect(stashCheck(found, wb([], [], { openExploration: true })).ok).toBe(true);
		const one = { ...A.sword, limit: 1 };
		expect(stashCheck(one, wb([], [], { stash: held(A.sword) })).ok).toBe(false);
	});
	it('a copy brings its upgrades and kit: their most and the limits count it', () => {
		const mole: Upgrade = { name: 'Trench Moles', keyword: null, max: 2, cost: 0, currency: 'ducats', for: [], text: '' };
		const r = readRules(null, null, [{ upgrades: [mole] }]);
		const two = [model('Yeoman', { upgrades: ['Trench Moles'] }), model('Yeoman', { upgrades: ['Trench Moles'] })];
		expect(reason(copyCheck({ ...two[0], id: 'c' }, wb(two), r))).toMatch(/Trench Moles: 2\/2/);
		const great: ScopedLimit = { text: 'At most 3 Great Swords', models: { holding: { names: ['Greatsword'] } }, max: 3 };
		const three = [1, 2, 3].map(() => model('Ranger', { equipment: held(A.greatsword) }));
		expect(reason(copyCheck({ ...three[0], id: 'c' }, wb(three, [great]), rules))).toMatch(/At most 3 Great Swords/);
		expect(copyCheck({ ...three[0], id: 'c' }, wb(three.slice(1), [great]), rules).ok).toBe(true);
	});
});
