import { describe, expect, it } from 'vitest';
import { equipCheck, hiredBy, itemFacts, readRules, recruitCheck, unitKit, warbandIssues, type ArmouryItem, type ModelState, type WarbandState } from './warband-rules';

// Made-up kit in the books' shapes (no book text lives in the repository).
const item = (name: string, category: ArmouryItem['category'], type: string | null, restrictions: string | null = null, extra: Partial<ArmouryItem> = {}): ArmouryItem => ({
	name,
	category,
	cost: 10,
	currency: 'ducats',
	limit: null,
	restrictions,
	type,
	range: category === 'melee' ? 'Melee' : category === 'ranged' ? '24"' : '-',
	keywords: [],
	...extra
});
const A = {
	rifle: item('Long Rifle', 'ranged', '2-Handed', 'Bayonet Lug'),
	pistol: item('Pocket Pistol', 'ranged', '1-Handed', null, { range: '12"/Melee' }),
	carbine: item('Carbine', 'ranged', '2-Handed', 'Bayonet Lug, Shield Combo, Limit: 2', { limit: 2 }),
	knife: item('Knife', 'melee', '1-Handed'),
	club: item('Club', 'melee', '1-Handed'),
	maul: item('Maul', 'melee', '2-Handed'),
	pike: item('Pike', 'melee', '2-Handed', null, { keywords: ['CUMBERSOME'] }),
	bayonet: item('Bayonet', 'melee', '1-Handed', 'Shield Combo'),
	shield: item('Wall Shield', 'shield', 'Shield', 'Shield Combo'),
	buckler: item('Buckler', 'shield', 'Shield'),
	frag: item('Frag', 'grenade', 'Grenade'),
	smoke: item('Smoke Bomb', 'grenade', 'Grenade'),
	plate: item('Plate', 'armour', 'Armour'),
	mail: item('Mail', 'armour', 'Armour'),
	helm: item('Helm', 'equipment', 'Equipment', 'Headgear'),
	hood: item('Hood', 'equipment', 'Equipment', 'Headgear'),
	medkit: item('Kit Bag', 'equipment', 'Equipment'),
	banner: item('Banner', 'equipment', 'Equipment', 'ELITE only, Limit: 1', { limit: 1 }),
	scope: item('Scope', 'equipment', 'Equipment', 'Rifle only'),
	charge: item('Charge', 'grenade', 'Grenade', 'Consumable, Limit: 3 (1 per model)', { limit: 3 }),
	relic: item('Relic', 'equipment', 'Equipment', null, { cost: 3, currency: 'glory' })
};
const armoury = Object.values(A);
const model = (over: Partial<ModelState> = {}): ModelState => ({
	id: 'm',
	type: 'Grunt',
	category: 'troop',
	keywords: [],
	status: 'active',
	equipment: [],
	upgrades: [],
	kit: { fixed: [], swap: null, except: [], nothingElse: false },
	...over
});
const has = (...xs: ArmouryItem[]) => xs.map((x) => ({ name: x.name, cost: x.cost, currency: x.currency }));
const wb = (models: ModelState[], over: Partial<WarbandState> = {}): WarbandState => ({ models, stash: [], ducats: 700, glory: 0, armoury, unrestricted: false, ...over });
const check = (m: ModelState, i: ArmouryItem, over: Partial<WarbandState> = {}) => equipCheck(m, i, wb([m], over));
const reason = (c: ReturnType<typeof check>) => (c.ok ? 'ok' : c.reason);

describe('battlekit limits (Rulebook)', () => {
	it('two 1-handed or one 2-handed ranged weapon', () => {
		expect(check(model({ equipment: has(A.pistol) }), A.pistol).ok).toBe(true);
		expect(reason(check(model({ equipment: has(A.pistol, A.pistol) }), A.pistol))).toMatch(/No free hands for a ranged/);
		expect(reason(check(model({ equipment: has(A.rifle) }), A.pistol))).toMatch(/No free hands/);
	});
	it('the same for melee; STRONG carries a 2-handed weapon in one hand, unless CUMBERSOME', () => {
		expect(reason(check(model({ equipment: has(A.maul) }), A.knife))).toMatch(/melee/);
		expect(check(model({ keywords: ['STRONG'], equipment: has(A.maul) }), A.knife).ok).toBe(true);
		expect(check(model({ keywords: ['STRONG'], equipment: has(A.pike) }), A.knife).ok).toBe(false);
	});
	it('a shield takes a hand: one 1-handed weapon of each kind, 2-handed only with Shield Combo on both', () => {
		expect(reason(check(model({ equipment: has(A.buckler, A.club) }), A.knife))).toMatch(/With a Shield/);
		expect(reason(check(model({ equipment: has(A.buckler) }), A.rifle))).toMatch(/Shield Combo/);
		expect(check(model({ equipment: has(A.shield) }), A.carbine).ok).toBe(true);
		expect(check(model({ equipment: has(A.shield) }), A.rifle).ok).toBe(false);
	});
	it('one grenade type, one armour, one shield, one headgear, no duplicate equipment', () => {
		expect(reason(check(model({ equipment: has(A.frag) }), A.smoke))).toBe('Only one type of Grenade');
		expect(reason(check(model({ equipment: has(A.plate) }), A.mail))).toBe('Only one suit of Armour');
		expect(reason(check(model({ equipment: has(A.buckler) }), A.shield))).toBe('Only one Shield');
		expect(reason(check(model({ equipment: has(A.helm) }), A.hood))).toBe('Only one piece of Headgear');
		expect(reason(check(model({ equipment: has(A.medkit) }), A.medkit))).toMatch(/Already has/);
	});
});

describe('armoury stipulations (Warbands)', () => {
	it('reads stipulations', () => {
		expect(itemFacts(A.charge)).toMatchObject({ consumable: true, perModel: 1, only: [] });
		expect(itemFacts(A.banner).only).toEqual(['ELITE']);
		expect(itemFacts(item('Heavy Plate', 'armour', 'Armour', 'Mechanized Heavy Infantry, ELITE only')).only).toEqual(['Mechanized Heavy Infantry', 'ELITE']);
		expect(itemFacts(A.pistol).dual).toBe(true);
	});
	it('ELITE only, "X only" and Rifle only', () => {
		expect(reason(check(model(), A.banner))).toBe('ELITE only');
		expect(check(model({ category: 'elite' }), A.banner).ok).toBe(true);
		expect(check(model(), A.scope).ok).toBe(false);
		expect(check(model({ equipment: has(A.rifle) }), A.scope).ok).toBe(true);
	});
	it('limits count the whole warband and the stash; per-model limits too', () => {
		const a = model({ id: 'a', category: 'elite', equipment: has(A.banner) });
		const b = model({ id: 'b', category: 'elite' });
		expect(reason(equipCheck(b, A.banner, wb([a, b])))).toBe('Limit 1/1 used');
		expect(reason(equipCheck(b, A.carbine, wb([a, b], { stash: has(A.carbine, A.carbine) })))).toBe('Limit 2/2 used');
		expect(reason(check(model({ equipment: has(A.charge) }), A.charge))).toMatch(/Only one type|per model/);
	});
	it('a bayonet needs a Bayonet Lug; the strongbox must cover the cost', () => {
		expect(reason(check(model(), A.bayonet))).toMatch(/Bayonet Lug/);
		expect(check(model({ equipment: has(A.rifle) }), A.bayonet).ok).toBe(true);
		expect(reason(check(model(), A.relic))).toMatch(/Costs 3 Glory; 0/);
		expect(check(model(), A.relic, { glory: 5 }).ok).toBe(true);
	});
	it('unit battlekit notes: fixed kit, swaps, exclusions', () => {
		expect(unitKit('A Medic always has Standard Armour, a Gas Mask, a Medi-kit, and a Knife (▶ see Battlekit). They can also have any Battlekit from the Armoury Tables, apart from Armour.')).toMatchObject({
			fixed: ['Standard Armour', 'Gas Mask', 'Medi-kit', 'Knife'],
			except: ['armour']
		});
		expect(unitKit('A Walker always has either Reinforced Armour at cost of 85 👑, or Machine Armour at a cost of 95 👑. Their Armour cannot be removed.').swap).toEqual({ from: 'Reinforced Armour', to: 'Machine Armour', extra: 10 });
		expect(unitKit('A Hound always has Teeth and Claws. These are part of the Hound. It cannot have any other Battlekit.')).toMatchObject({ fixed: ['Teeth', 'Claws'], nothingElse: true });
		expect(unitKit('A Witch always has Bombs, and can have Battlekit from the Armoury Tables except for Ranged Weapons or Grenades.').except).toEqual(['ranged', 'grenade']);
		const m = model({ kit: unitKit('It cannot have any other Battlekit.') });
		expect(check(m, A.knife).ok).toBe(false);
	});
	it('the unrestricted switch skips every check', () => {
		expect(check(model({ equipment: has(A.frag) }), A.smoke, { unrestricted: true }).ok).toBe(true);
	});
});

describe('faction and variant rules', () => {
	const faction = 'You have 700 👑 to recruit a Holy Warband for a campaign. Holy Warbands are Faithful.\n\n* Pairs: A Holy Warband can include up to 2 Fireteams.';
	const variant = [
		'The following special rules apply to a Pilgrim Band Warband.',
		'* Far Away: A Pilgrim Band Warband cannot include Moles.',
		'* Abbot: A Pilgrim Band Warband must include 1 Cleric, but does not have to include a Captain. A Cleric in a Pilgrim Band Warband has the LEADER Keyword.',
		'* Small Force: You have 500 👑 and 11 ☼ to recruit a Pilgrim Band Warband for a campaign.',
		'* Blessing: When you recruit a Pilgrim Band Warband, you must give the Holy Relic to one model in the Warband. The Holy Relic taken when the Warband is created is free.',
		'* Guard: The Captain and up to 4 models in a Pilgrim Band Warband can have the NEGATE FEAR Keyword at no additional cost in 👑.',
		'* Few: A Pilgrim Band Warband can only include 0-2 Hounds.'
	].join('\n\n');
	const r = readRules(faction, variant);
	it('reads money, alignment and Fireteams', () => {
		expect(r).toMatchObject({ startDucats: 500, startGlory: 11, alignment: 'faithful', fireteams: 2 });
		expect(readRules(faction)).toMatchObject({ startDucats: 700, startGlory: 0 });
	});
	it('reads exclusions, the leader, must-includes, caps, free items and upgrades', () => {
		expect(r.excluded).toEqual(['Moles']);
		expect(r.leader).toBe('Cleric');
		expect(r.mustInclude).toEqual([{ name: 'Cleric', n: 1 }]);
		expect(r.optional).toEqual(['Captain']);
		expect(r.caps).toEqual([{ name: 'Hounds', max: 2 }]);
		expect(r.freeItems).toEqual(['Holy Relic']);
		expect(r.upgrades[0]).toMatchObject({ name: 'Guard', keyword: 'NEGATE FEAR', max: 4, cost: 0 });
	});
	it('recruiting: exclusions, caps, the 6-ELITE limit, mercenary hiring, money', () => {
		const f = { name: 'Holy Warband', alignment: 'faithful' as const, variant: 'Pilgrim Band' };
		const entry = (name: string, extra = {}) => ({ name, category: 'troop' as const, availabilityMax: null, cost: 30, currency: 'ducats' as const, keywords: [], ...extra });
		expect(recruitCheck(entry('Mole'), wb([]), r, f).ok).toBe(false);
		const hounds = [model({ type: 'Hound' }), model({ type: 'Hound' })];
		expect(recruitCheck(entry('Hounds'), wb(hounds), r, f)).toEqual({ ok: false, reason: 'Limit reached (2/2)' });
		const six = Array.from({ length: 6 }, () => model({ category: 'elite' }));
		expect(recruitCheck(entry('Knight', { category: 'elite' }), wb(six), r, f).ok).toBe(false);
		const merc = (hire: ReturnType<typeof hiredBy>) => entry('Sellsword', { category: 'mercenary', currency: 'glory', cost: 2, hire });
		expect(hiredBy('A Sellsword is Faithful and can be recruited as a Mercenary by Holy Warband and Iron Warbands.')).toEqual({ alignment: 'faithful', by: ['Holy', 'Iron'] });
		expect(recruitCheck(merc({ alignment: 'fallen', by: ['Dark'] }), wb([], { glory: 5 }), r, f).ok).toBe(false);
		expect(recruitCheck(merc({ alignment: 'faithful', by: [] }), wb([], { glory: 5 }), r, f).ok).toBe(true);
		expect(recruitCheck(merc({ alignment: 'faithful', by: [] }), wb([]), r, f)).toEqual({ ok: false, reason: 'Costs 2 Glory; 0 in the strongbox' });
	});
	it('lists what makes a warband illegal', () => {
		const issues = warbandIssues(wb([model({ type: 'Mole' })]), r, []);
		expect(issues).toContain('The warband must include its Leader (Cleric).');
		expect(issues).toContain('The warband must include 1 Cleric.');
		expect(issues).toContain('It cannot include Moles.');
		expect(warbandIssues(wb([model({ type: 'Cleric' })]), r, [])).toEqual([]);
	});
});
