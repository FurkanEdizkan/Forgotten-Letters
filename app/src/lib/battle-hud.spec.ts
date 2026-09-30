import { describe, expect, it } from 'vitest';
import { battleBrief, hudRoster } from './battle-hud';

const unit = (id: string, leader = false) => ({ id, leader });

describe('hudRoster', () => {
	it('puts the leader first and keeps the roster order otherwise', () => {
		expect(hudRoster([unit('a'), unit('b'), unit('boss', true), unit('c')]).map((u) => u.id)).toEqual(['boss', 'a', 'b', 'c']);
	});
	it('leaves a roster with no leader as it is, without changing the original', () => {
		const roster = [unit('b'), unit('a')];
		expect(hudRoster(roster).map((u) => u.id)).toEqual(['b', 'a']);
		expect(hudRoster([])).toEqual([]);
		expect(roster.map((u) => u.id)).toEqual(['b', 'a']);
	});
});

const zone = { id: 'z1', name: 'Holy Choked Path', type: 'basic' as const, resources: ['F' as const, 'T' as const], archetype: 'no-mans-land' as const };
const warbands = [
	{ id: 'a', player: 'Alric', outposts: ['z1'] },
	{ id: 'd', player: 'Brun', outposts: [] }
];
const game = { aggressor: 'a', defender: 'd', scenario: null, weatherEvent: null, weatherRolls: null };

describe('battleBrief', () => {
	it('describes the battlefield: kind, resources, bonus, outpost holders', () => {
		const b = battleBrief({ game, zone: { ...zone, type: 'special', bonus: 'An Omen of Leviathan.' }, warbands, regions: [] });
		expect(b.battlefield).toEqual({
			name: 'Holy Choked Path',
			kind: 'Special Zone',
			resources: ['F', 'T'],
			bonus: 'An Omen of Leviathan.',
			holders: ['Alric'],
			weather: null
		});
	});
	it("names the zone's own regional weather before the map-wide one", () => {
		const regions = [
			{ name: 'The Front', zones: null, weatherEvent: 3 },
			{ name: 'The Marsh', zones: ['z1'], weatherEvent: 5 }
		];
		expect(battleBrief({ game, zone, warbands, regions }).battlefield.weather).toEqual({
			region: 'The Marsh',
			name: 'Churning Mud',
			effect: '-1 DICE to Risky rolls for Dash actions.'
		});
	});
	it('splits a rolled scenario into archetype, deployment and victory conditions', () => {
		const b = battleBrief({ game: { ...game, scenario: "No Man's Land: Tunnels / Over the Top" }, zone, warbands, regions: [] });
		expect(b.scenario).toEqual({ state: 'rolled', archetype: "No Man's Land", deployment: 'Tunnels', victory: 'Over the Top' });
	});
	it("shows a zone's fixed scenario by name, and a pending one with its archetype", () => {
		expect(battleBrief({ game, zone: { ...zone, archetype: undefined, scenario: 'The Siege of Pillars' }, warbands, regions: [] }).scenario).toEqual({
			state: 'named',
			name: 'The Siege of Pillars'
		});
		expect(battleBrief({ game, zone, warbands, regions: [] }).scenario).toEqual({ state: 'pending', archetype: "No Man's Land" });
	});
	it('gives the Hell on Earth event with each side’s dice and who chose', () => {
		const rolled = { ...game, weatherEvent: 11, weatherRolls: { aggressor: [4, 3] as [number, number], defender: [5, 6] as [number, number], chooser: 'd' } };
		expect(battleBrief({ game: rolled, zone, warbands, regions: [] }).hell).toEqual({
			name: 'Raining Blood',
			effect: '+1" to Charge Bonus.',
			rolls: [
				{ player: 'Alric', dice: [4, 3], total: 7 },
				{ player: 'Brun', dice: [5, 6], total: 11 }
			],
			chooser: 'Brun'
		});
	});
	it('reports no event before the roll, and no chooser on a tie', () => {
		expect(battleBrief({ game, zone, warbands, regions: [] }).hell).toBe(null);
		const tie = { ...game, weatherEvent: 7, weatherRolls: { aggressor: [3, 4] as [number, number], defender: null, chooser: null } };
		expect(battleBrief({ game: tie, zone, warbands, regions: [] }).hell).toMatchObject({
			name: 'Grim and Indifferent',
			rolls: [{ player: 'Alric', dice: [3, 4], total: 7 }],
			chooser: null
		});
	});
});
