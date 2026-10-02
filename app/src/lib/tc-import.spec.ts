import { describe, expect, it } from 'vitest';
import { factionByName, fromTcText, matchToBook, readTcExport, toTcText, type Book } from './tc-import';
import { fromOwnExport, fromTrenchCompanion } from './roster';
import type { ArmouryItem } from './warband-rules';
import type { ProfileData } from './builder-state';

// Made-up warband in Trench Companion's "Full" export layout (Discord formatting, labels, bullets).
const FULL = `## The Grey Company (Someone) ##

Faction: Papal States Intervention Force
Rating: 400 Ducats | 9 Glory
Patron: A Patron

## Elites ##

**Officer**
• Cost: 120 Ducats | 3 Glory
• Upgrades & Choices: Guard
• Battlekit: Long Rifle, Knife, Relic

**Brother Anselm (Officer)**
• Cost: 80 Ducats | 0 Glory
• Battlekit: Knife

## Troops ##

**Grunt**
• Cost: 45 Ducats | 0 Glory
• Battlekit: Long Rifle, Mystery Thing

## Mercenaries ##

**Sellsword**
• Cost: 0 Ducats | 6 Glory
• Battlekit: Sellsword Blade

## Stash ##

Stashed Ducats: 12
Unspent Glory: 2

## Fireteams ##

A Fireteam
• Grunt
• Officer

--- View online:
https://trench-companion.com/warband/detail/1234`;

const profile = (name: string, category: ProfileData['category'], cost: number, over: Partial<ProfileData> = {}): ProfileData => ({
	id: `p-${name}`,
	name,
	faction: 'f',
	variant: null,
	category,
	availabilityMax: null,
	cost,
	currency: 'ducats',
	keywords: [],
	stats: { movement: '6"' },
	battlekitNote: null,
	description: null,
	abilities: [],
	...over
});
const item = (name: string, category: ArmouryItem['category'], cost: number, currency: 'ducats' | 'glory' = 'ducats'): ArmouryItem => ({
	name,
	category,
	cost,
	currency,
	limit: null,
	restrictions: null,
	type: null,
	range: null,
	keywords: []
});
const book: Book = {
	profiles: [
		profile('Officer', 'elite', 70),
		profile('Grunt', 'troop', 40, { kit: { prices: { 'Long Rifle': { cost: 5, currency: 'ducats' } } } }),
		profile('Sellsword', 'mercenary', 6, { currency: 'glory', kit: { fixed: ['Sellsword Blade'] } })
	],
	armoury: [item('Long Rifle', 'ranged', 10), item('Knife', 'melee', 2), item('Relic', 'equipment', 3, 'glory'), item('Sellsword Blade', 'melee', 4)],
	upgrades: [{ name: 'Guard', keyword: 'NEGATE FEAR', max: 3, cost: 0, currency: 'ducats', for: [], text: '' }]
};

describe('the text export', () => {
	const imp = fromTcText(FULL);
	it('reads the head, the banks and the faction (a variant by its name)', () => {
		expect(imp.name).toBe('The Grey Company (Someone)');
		expect([imp.faction, imp.variant]).toEqual(['new-antioch', 'Papal States Intervention Force']);
		expect(imp.patron).toBe('A Patron');
		expect([imp.ducats, imp.glory]).toEqual([12, 2]);
	});
	it('reads each model with its section, costs, upgrades and kit; a fighter name before its entry', () => {
		expect(imp.units.map((u) => [u.name, u.type, u.category])).toEqual([
			['Officer', 'Officer', 'elite'],
			['Brother Anselm', 'Officer', 'elite'],
			['Grunt', 'Grunt', 'troop'],
			['Sellsword', 'Sellsword', 'mercenary']
		]);
		expect(imp.units[0].tcTotal).toEqual({ ducats: 120, glory: 3 });
		expect(imp.units[0].upgrades).toEqual(['Guard']);
		expect(imp.units[0].equipment.map((e) => e.name)).toEqual(['Long Rifle', 'Knife', 'Relic']);
	});
	it('numbers fireteams Trench Companion names alike', () => {
		const two = fromTcText(`L\nFaction: Iron Sultanate\nElites\nOfficer - 70 D\nOfficer - 70 D\nFireteams\nTeam\n• Officer\nTeam\n• Officer`);
		expect(two.fireteams.map((f) => f.name)).toEqual(['Team', 'Team 2']);
	});
	it('reads fireteams, each model once, in list order', () => {
		expect(imp.fireteams).toEqual([{ name: 'A Fireteam', members: [2, 0] }]);
	});
	it('works without Discord formatting, labels or bullets (cost on the name line)', () => {
		const plain = fromTcText(`Plain List\nFaction: Iron Sultanate\nElites\nOfficer - 70 D | 0 G\nBattlekit: Knife`);
		expect(plain.faction).toBe('iron-sultanate');
		expect(plain.units[0].tcTotal).toEqual({ ducats: 70, glory: 0 });
	});
	it('takes JSON too, and refuses text with no models', () => {
		expect(() => readTcExport('Just some words', fromTrenchCompanion)).toThrow(/No models/);
		expect(readTcExport('{"name":"J","models":[]}', fromTrenchCompanion).name).toBe('J');
	});
	it('knows factions and variants by name', () => {
		expect(factionByName('Trench Pilgrims').faction).toBe('trench-pilgrims');
		expect(factionByName('Cult of the Black Grail').faction).toBe('black-grail');
		expect(factionByName('Nobody Knows').faction).toBeNull();
	});
});

describe('matching to the books', () => {
	const { imported, report } = matchToBook(fromTcText(FULL), book);
	const [officer, , grunt, merc] = imported.units;
	it('gives each model its entry: profile, stats, the book name and category', () => {
		expect(officer.profileId).toBe('p-Officer');
		expect(officer.stats.movement).toBe('6"');
		expect(merc.category).toBe('mercenary');
		expect(merc.currency).toBe('glory');
	});
	it('prices kit from the books (an entry\'s own price, fixed kit free) and keeps Trench Companion\'s totals', () => {
		expect(grunt.equipment.find((e) => e.name === 'Long Rifle')?.cost).toBe(5);
		expect(grunt.cost).toBe(45 - 5);
		expect(merc.equipment[0].cost).toBe(0);
		expect(merc.cost).toBe(6);
		expect(officer.cost).toBe(120 - 10 - 2);
		expect(officer.equipment.map((e) => e.kind)).toEqual(['ranged', 'melee', 'equipment']);
	});
	it('reports what it couldn\'t match, and keeps it', () => {
		expect(report.items).toEqual([{ unit: 'Grunt', item: 'Mystery Thing' }]);
		expect(grunt.equipment.some((e) => e.name === 'Mystery Thing')).toBe(true);
		expect(report.units).toEqual([]);
		expect(report.upgrades).toEqual([]);
		expect(report.costs).toEqual([]);
	});
	it('reports a currency the books\' prices don\'t add up to', () => {
		const r = matchToBook(fromTcText(FULL.replace('120 Ducats | 3 Glory', '120 Ducats | 5 Glory')), book).report;
		expect(r.costs[0]).toMatch(/Officer: .*3 glory.*5/);
	});
});

describe('finding the entry', () => {
	const units = (text: string) => matchToBook(fromTcText(text), { ...book, paragraphs: ['* Captain: A warband must include 1 Officer, who leads it.'] });
	it('by a rule of that name: the entry it names', () => {
		const { imported, report } = units(`L\nFaction: Iron Sultanate\nElites\nCaptain - 70 D | 0 G`);
		expect(imported.units[0].type).toBe('Officer');
		expect(imported.units[0].name).toBe('Captain');
		expect(report.units).toEqual([]);
	});
	it("by Trench Companion's own id for the model", () => {
		const imp = fromTrenchCompanion({ name: 'J', models: [{ purchase: { purchaseid: 'x' }, model: { name: 'Odd Name', model: 'md_grunt_veteran' } }] });
		expect(matchToBook(imp, book).imported.units[0].type).toBe('Grunt');
	});
	it("a mercenary's kit is never bought", () => {
		const { imported } = units(`L\nFaction: Iron Sultanate\nMercenaries\nSellsword - 0 D | 6 G\nBattlekit: Sellsword Blade, Knife`);
		expect(imported.units[0].equipment.map((e) => e.cost)).toEqual([0, 0]);
		expect(imported.units[0].cost).toBe(6);
	});
});

describe('the JSON', () => {
	it('brings fireteams (by Trench Companion\'s ids), statuses, real kit names and upgrade names', () => {
		const imp = fromTrenchCompanion({
			name: 'J',
			models: [
				{ purchase: { purchaseid: 'md_a_1', cost_value: 50 }, model: { name: 'Officer', active: 'active', equipment: [{ purchase: { cost_value: 0 }, equipment: { name: 'Gas Mask', id: 'rel_md_eq_x_eq_gasmask_0' } }], list_upgrades: [{ purchase: { custom_rel: { name: 'Guard (Officer)' } } }] } },
				{ purchase: { purchaseid: 'md_b_2', cost_value: 40 }, model: { name: 'Grunt', active: 'retired' } },
				{ purchase: { purchaseid: 'md_c_3', cost_value: 40 }, model: { name: 'Grunt', active: 'dead' } }
			],
			fireteams: [{ object_id: 'ft_x_rl_newantiochfireteam_0', selections: [{ selection_ID: 'md_b_2' }, { selection_ID: 'md_a_1' }] }]
		});
		expect(imp.units[0].equipment[0].name).toBe('Gas Mask');
		expect(imp.units[0].upgrades).toEqual(['Guard (Officer)']);
		expect(matchToBook(imp, book).imported.units[0].upgrades).toEqual(['Guard']);
		expect(imp.units.map((u) => u.status)).toEqual(['active', 'retired', 'dead']);
		expect(imp.fireteams).toEqual([{ name: 'Fireteam 1', members: [1, 0] }]);
	});
});

describe('our text export', () => {
	it('reads back as the same warband', () => {
		const item = (name: string, cost: number, currency: 'ducats' | 'glory' = 'ducats') => ({ name, kind: 'equipment' as const, cost, currency });
		const text = toTcText({
			name: 'The Grey Company',
			faction: 'Papal States Intervention Force',
			patron: 'A Patron',
			ducats: 12,
			glory: 2,
			units: [
				{ id: 'a', name: 'Anselm', type: 'Officer', category: 'elite', cost: 60, currency: 'ducats', experience: 3, status: 'active', equipment: [item('Long Rifle', 10), item('Relic', 3, 'glory')], upgrades: ['Guard'], skills: ['Fleet'], injuries: ['Lame'] },
				{ id: 'b', name: '', type: 'Grunt', category: 'troop', cost: 35, currency: 'ducats', experience: 0, status: 'active', equipment: [item('Knife', 2)], upgrades: [], skills: [], injuries: [] },
				{ id: 'c', name: '', type: 'Sellsword', category: 'mercenary', cost: 6, currency: 'glory', experience: 0, status: 'active', equipment: [], upgrades: [], skills: [], injuries: [] }
			],
			stash: [item('Medi-kit', 5)],
			fireteams: [{ name: 'Pair', members: ['b', 'a'] }]
		});
		const back = fromTcText(text);
		expect(back.name).toBe('The Grey Company');
		expect(factionByName(back.sourceFaction).variant).toBe('Papal States Intervention Force');
		expect(back.patron).toBe('A Patron');
		expect(back.units.map((u) => [u.name, u.type, u.category])).toEqual([
			['Anselm', 'Officer', 'elite'],
			['Grunt', 'Grunt', 'troop'],
			['Sellsword', 'Sellsword', 'mercenary']
		]);
		expect(back.units[0]).toMatchObject({ experience: 3, skills: ['Fleet'], injuries: ['Lame'], upgrades: ['Guard'], tcTotal: { ducats: 70, glory: 3 } });
		expect(back.units[0].equipment.map((e) => e.name)).toEqual(['Long Rifle', 'Relic']);
		expect(back.ducats).toBe(12);
		expect(back.glory).toBe(2);
		expect(back.stash.map((s) => s.name)).toEqual(['Medi-kit']);
		expect(back.fireteams?.[0]).toMatchObject({ name: "Pair", members: [1, 0] });
	});
});

describe('our JSON export', () => {
	it('reads back with its patron, progress and fireteams', () => {
		const raw = {
			app: 'carcass-front-warband',
			version: 1,
			warband: { name: 'W', faction: 'new-antioch', variant: null, patron: 'A Patron', ducats: 5, glory: 1, fireteams: [{ name: 'T', members: [0, -1] }] },
			models: [{ name: 'A', type: 'Officer', category: 'elite', leader: false, cost: 60, currency: 'ducats', experience: 4, equipment: [], upgrades: [], skills: ['Fleet'], injuries: [], stats: {}, status: 'active' }],
			arsenal: [{ name: 'Knife', kind: 'melee', cost: 2, currency: 'ducats' }]
		};
		const imp = readTcExport(JSON.stringify(raw), (r) => fromOwnExport(r) ?? fromTrenchCompanion(r));
		expect(imp).toMatchObject({ name: 'W', faction: 'new-antioch', patron: 'A Patron', ducats: 5, glory: 1, fireteams: [{ name: 'T', members: [0] }] });
		expect(imp.units[0]).toMatchObject({ experience: 4, skills: ['Fleet'] });
		expect(fromOwnExport({ app: 'something-else' })).toBeNull();
	});
});
