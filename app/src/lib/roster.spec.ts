import { describe, expect, it } from 'vitest';
import { fromTrenchCompanion, humaniseId, rosterTotals, rosterWarnings, sellValue, trenchCompanionId, type RosterUnit } from './roster';

const unit = (over: Partial<RosterUnit> = {}): RosterUnit => ({
	name: 'Brother',
	type: 'Trench Pilgrim',
	category: 'troop',
	leader: false,
	cost: 20,
	currency: 'ducats',
	experience: 0,
	equipment: [],
	upgrades: [],
	skills: [],
	injuries: [],
	stats: {},
	status: 'active',
	...over
});

describe('roster money', () => {
	it('sells for half, rounded up', () => {
		expect(sellValue(15)).toBe(8);
		expect(sellValue(10)).toBe(5);
	});

	it('totals active models, their gear and the stash, per currency', () => {
		const units = [
			unit({ cost: 80, equipment: [{ name: 'Great Sword', kind: 'melee', cost: 12, currency: 'ducats' }] }),
			unit({ cost: 2, currency: 'glory' }),
			unit({ cost: 50, status: 'dead' })
		];
		expect(rosterTotals(units, [{ name: 'Shovel', kind: 'equipment', cost: 5, currency: 'ducats' }])).toEqual({ ducats: 97, glory: 2 });
	});

	it('warns without exactly one Leader', () => {
		expect(rosterWarnings([unit()])).toContain('No Leader: every warband needs one.');
		expect(rosterWarnings([unit({ leader: true }), unit({ leader: true })])).toContain('More than one Leader.');
		expect(rosterWarnings([unit({ leader: true })])).toEqual([]);
	});
});

describe('Trench Companion import', () => {
	// Synthetic fixture shaped like the share-link JSON (warband_data is a JSON string).
	const warbandData = {
		name: 'Spuds',
		ducat_bank: 700,
		glory_bank: 3,
		equipment: [{ purchase: { cost_value: 5, cost_type: 0 }, equipment: { id: 'eq_shovel', name: 'Shovel' } }],
		models: [
			{
				purchase: { cost_value: 80, cost_type: 0, custom_rel: { captain: true, mercenary: false } },
				model: {
					name: 'Executor',
					model: 'md_plagueknight_executor',
					elite: true,
					experience: 4,
					active: 'active',
					equipment: [{ purchase: { cost_value: 15, cost_type: 0 }, equipment: { id: 'eq_graildevotee', name: 'Grail Devotee' } }],
					list_skills: [{ object_id: 'sk_hardened_veteran' }],
					list_injury: [],
					list_upgrades: [{ purchase: { cost_value: 5, cost_type: 0, purchaseid: 'up_rotten_cross' } }]
				}
			},
			{
				purchase: { cost_value: 2, cost_type: 1, custom_rel: { mercenary: true } },
				model: { name: 'Hired Blade', elite: false, experience: 0, active: 'dead', equipment: [] }
			}
		]
	};
	const imported = fromTrenchCompanion({ id: 1, warband_data: JSON.stringify(warbandData) });

	it('maps banks, models, gear and stash', () => {
		expect(imported).toMatchObject({ name: 'Spuds', ducats: 700, glory: 3 });
		expect(imported.stash).toEqual([{ name: 'Shovel', kind: 'equipment', cost: 5, currency: 'ducats' }]);
		expect(imported.units[0]).toMatchObject({
			name: 'Executor', category: 'elite', leader: true, cost: 80, experience: 4, skills: ['Hardened Veteran'], status: 'active'
		});
		expect(imported.units[0].equipment[0]).toMatchObject({ name: 'Grail Devotee', cost: 15 });
		expect(imported.units[0].upgrades).toEqual(['Rotten Cross']);
		expect(imported.units[1]).toMatchObject({ category: 'mercenary', currency: 'glory', status: 'dead' });
	});

	it('rejects other JSON', () => {
		expect(() => fromTrenchCompanion({ hello: 'world' })).toThrow();
	});

	it('reads share links and ids', () => {
		expect(trenchCompanionId('https://trench-companion.com/warband/detail/225201')).toBe('225201');
		expect(trenchCompanionId('225201')).toBe('225201');
		expect(trenchCompanionId('https://evil.example/x')).toBeNull();
		expect(humaniseId('ab_undead_fortitude')).toBe('Undead Fortitude');
	});
});
