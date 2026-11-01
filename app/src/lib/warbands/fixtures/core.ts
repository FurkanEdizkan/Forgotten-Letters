/**
 * An invented rules set for the engine's specs: made-up factions, units and kit in the rules folder format, each
 * there to exercise one building rule. No book text. Parsed through the contract (`rulesSet`), so a fixture that
 * breaks the strict format fails loudly.
 */
import { rulesSet, type Limit, type RulesSet } from '../../rules/pack.ts';
import type { z } from 'zod';

type Input = z.input<typeof rulesSet>;
const kw = (k: string, value?: string | number) => ({
	kw: `kw:${k}`,
	...(value != null ? { value } : {})
});
const keyword = (name: string, param?: 'X' | 'X"' | 'keyword') => ({
	id: `kw:${name.toLowerCase().replace(/ /g, '-')}`,
	name,
	kind: 'both' as const,
	text: `${name} does a thing.`,
	...(param ? { param } : {})
});
type ItemIn = Input['items'] extends (infer T)[] | undefined ? T : never;
const item = (
	id: string,
	name: string,
	category: ItemIn['category'],
	type: ItemIn['type'],
	kws: ItemIn['keywords'] = []
) => ({
	id: `item:${id}`,
	name,
	category,
	type,
	keywords: kws
});
const line = (
	owner: string,
	itemId: string,
	cost: number,
	extra: Record<string, unknown> = {}
) => ({
	id: `line:${owner.replace(/^faction:/, '')}/${itemId}`,
	owner,
	item: `item:${itemId}`,
	cost,
	currency: 'ducats' as const,
	...extra
});
type UnitIn = Input['units'] extends (infer T)[] | undefined ? T : never;
const unit = (
	owner: string,
	id: string,
	name: string,
	category: UnitIn['category'],
	cost: number,
	extra: Partial<UnitIn> = {}
): UnitIn => ({
	id: `unit:${owner.replace(/^(faction|variant):/, '')}/${id}`,
	owner,
	name,
	category,
	availability: { min: 0, max: null },
	cost,
	currency: 'ducats',
	stats: { movement: '6"', armour: '0', base: '25mm' },
	keywords: [],
	abilities: [],
	kit: {},
	...extra
});

const O = 'faction:order';
export const U = (id: string) => `unit:order/${id}`;

const input: Input = {
	manifest: { id: 'test-core', name: 'Test core', kind: 'core', version: '1.0' },
	keywords: [
		...[
			'STRONG',
			'HEAVY',
			'CUMBERSOME',
			'HELD',
			'ELITE',
			'LEADER',
			'FIRETEAM',
			'FEAR',
			'DEMONIC',
			'FIRE'
		].map((n) => keyword(n)),
		keyword('NEGATE', 'keyword'),
		keyword('INJURY MODIFIER', 'X'),
		keyword('BLAST', 'X"')
	],
	items: [
		item('pistol', 'Pistol', 'ranged', '1-Handed'),
		item('rifle', 'Rifle', 'ranged', '2-Handed'),
		item('carbine', 'Carbine', 'ranged', '2-Handed'),
		item('lmg', 'Machine Gun', 'ranged', '2-Handed', [kw('heavy')]),
		item('flamer', 'Flamer', 'ranged', '2-Handed', [kw('heavy'), kw('fire')]),
		item('greatsword', 'Greatsword', 'melee', '2-Handed'),
		item('pike', 'Pike', 'melee', '2-Handed', [kw('cumbersome')]),
		item('polearm', 'Polearm', 'melee', '2-Handed'),
		item('sword', 'Sword', 'melee', '1-Handed'),
		item('knife', 'Knife', 'melee', '1-Handed'),
		item('bayonet', 'Bayonet', 'melee', '1-Handed'),
		item('frag', 'Frag', 'grenade', 'Grenade'),
		item('smoke', 'Smoke Bomb', 'grenade', 'Grenade'),
		item('mine', 'Mine', 'grenade', 'Grenade', [kw('heavy')]),
		item('shield', 'Wall Shield', 'shield', 'Shield'),
		item('buckler', 'Buckler', 'shield', 'Shield'),
		item('plate', 'Plate', 'armour', 'Armour', [kw('injury-modifier', -2)]),
		item('mail', 'Mail', 'armour', 'Armour', [kw('injury-modifier', -1)]),
		item('helm', 'Helm', 'equipment', 'Equipment'),
		item('hood', 'Hood', 'equipment', 'Equipment'),
		item('medkit', 'Kit Bag', 'equipment', 'Equipment'),
		item('banner', 'Banner', 'equipment', 'Equipment'),
		item('scope', 'Scope', 'equipment', 'Equipment'),
		item('charge', 'Charge', 'grenade', 'Grenade'),
		item('relic', 'Relic', 'equipment', 'Equipment'),
		item('holy-relic', 'Holy Relic', 'special', 'Special'),
		item('map', 'Old Map', 'special', 'Special'),
		item('lantern', 'Lantern', 'equipment', 'Equipment', [kw('held')]),
		item('teeth', 'Teeth', 'melee', '1-Handed')
	],
	armouryLines: [
		...['pistol', 'sword', 'knife', 'bayonet', 'frag', 'smoke', 'buckler', 'medkit', 'lantern'].map(
			(i) => line(O, i, 5)
		),
		line(O, 'rifle', 10, { stipulations: { bayonetLug: true } }),
		line(O, 'carbine', 12, { stipulations: { shieldCombo: true } }),
		line(O, 'lmg', 60),
		line(O, 'flamer', 30),
		line(O, 'greatsword', 12),
		line(O, 'pike', 8),
		line(O, 'polearm', 10, { stipulations: { shieldCombo: true } }),
		line(O, 'mine', 20),
		line(O, 'shield', 10, { stipulations: { shieldCombo: true } }),
		line(O, 'plate', 30),
		line(O, 'mail', 15),
		line(O, 'helm', 5, { stipulations: { headgear: true } }),
		line(O, 'hood', 5, { stipulations: { headgear: true } }),
		line(O, 'banner', 10, { limit: 1, stipulations: { only: { keywords: ['kw:elite'] } } }),
		line(O, 'scope', 5, { stipulations: { only: { holding: { items: ['item:rifle'] } } } }),
		line(O, 'charge', 5, { limit: 3, stipulations: { perModel: 1, consumable: true } }),
		line(O, 'holy-relic', 20),
		line(O, 'map', 5, { stipulations: { explorationOnly: true } }),
		line('faction:glory-items', 'relic', 3, { currency: 'glory' }),
		line('faction:mercenaries', 'teeth', 0)
	],
	factions: [
		{
			id: O,
			name: 'Order of Tests',
			alignment: 'faithful',
			startDucats: 700,
			startGlory: 10,
			fireteams: 1,
			gloryTable: 'faction:glory-items',
			mercenaries: []
		},
		{
			id: 'faction:legion',
			name: 'Legion of Mocks',
			alignment: 'fallen',
			startDucats: 700,
			startGlory: 0
		},
		{
			id: 'faction:court',
			name: 'Court of Stubs',
			alignment: 'fallen',
			startDucats: 700,
			startGlory: 0,
			dedications: [
				{ key: 'wrath', name: 'Wrath' },
				{ key: 'greed', name: 'Greed' }
			]
		}
	],
	variants: [
		{
			id: 'variant:order/pilgrims',
			faction: O,
			name: 'Pilgrim Band',
			replaces: [{ from: U('trooper'), to: 'unit:order/pilgrims/pilgrim' }],
			excludes: [U('knight'), 'item:flamer'],
			rules: {
				startDucats: 500,
				caps: [{ unit: U('sergeant'), max: 1 }],
				freeItems: ['item:holy-relic'],
				patron: 'patron:saint',
				limits: [
					{ name: 'Few Hounds', text: 'At most 1 Hound', models: { units: [U('hound')] }, max: 1 }
				]
			}
		}
	],
	units: [
		unit(O, 'captain', 'Captain', 'elite', 60, {
			availability: { min: 1, max: 1 },
			keywords: [kw('leader')]
		}),
		unit(O, 'sergeant', 'Sergeant', 'elite', 40, { availability: { min: 0, max: 2 } }),
		unit(O, 'trooper', 'Trooper', 'troop', 20),
		unit('variant:order/pilgrims', 'pilgrim', 'Pilgrim', 'troop', 15),
		unit(O, 'knight', 'Knight', 'elite', 80, {
			kit: { limits: [{ text: 'Must wear Armour', items: { categories: ['armour'] }, min: 1 }] }
		}),
		unit(O, 'thrall', 'Thrall', 'troop', 10, {
			kit: {
				limits: [
					{
						text: 'Only a Sword or Knife',
						items: { not: { items: ['item:sword', 'item:knife'] } },
						max: 0
					}
				]
			}
		}),
		unit(O, 'mamluk', 'Mamluk', 'troop', 30, {
			kit: {
				loadouts: [
					['item:greatsword'],
					['item:polearm', 'item:shield'],
					['item:pistol', ['item:sword', 'item:knife']]
				]
			}
		}),
		unit(O, 'amalgam', 'Amalgam', 'elite', 90, {
			kit: {
				hands: { ranged: 6, melee: 6 },
				heavyOneHand: 2,
				limits: [
					{
						text: 'Six weapons',
						items: { categories: ['ranged', 'melee'] },
						count: 'weapons',
						max: 6
					}
				]
			}
		}),
		unit(O, 'homunculus', 'Homunculus', 'troop', 25, { kit: { hands: { melee: 3 } } }),
		unit(O, 'hound', 'Hound', 'troop', 15, { kit: { fixed: ['item:teeth'], nothingElse: true } }),
		unit(O, 'medic', 'Medic', 'troop', 30, { kit: { fixed: ['item:plate'], except: ['armour'] } }),
		unit(O, 'hellknight', 'Hell Knight', 'elite', 100, {
			stats: { armour: '-1', base: '40mm' },
			kit: { fixed: ['item:plate'], includedInCost: true }
		}),
		unit(O, 'martyr', 'Martyr', 'troop', 0, { kit: { recruit: false } }),
		unit(O, 'sipahi', 'Sipahi', 'troop', 30, {
			kit: { items: { 'item:rifle': { shieldCombo: true } } }
		}),
		unit(O, 'brute', 'Brute', 'troop', 30, { keywords: [kw('strong')] }),
		unit(O, 'warlock', 'Warlock', 'elite', 3, {
			currency: 'glory',
			upgrades: ['upgrade:order/hellfire', 'upgrade:order/dread', 'upgrade:order/speed'],
			kit: { limits: [{ text: 'At most 2 Goetic Powers', upgrades: ['Goetic Power'], max: 2 }] }
		}),
		unit(O, 'devil', 'Devil', 'troop', 40, { keywords: [kw('demonic')] }),
		unit(O, 'wretch', 'Wretch', 'troop', 5),
		unit('faction:mercenaries', 'sellsword', 'Sellsword', 'mercenary', 2, {
			currency: 'glory',
			hiredBy: { alignment: 'faithful' },
			kit: { fixed: ['item:teeth'] }
		}),
		unit('faction:mercenaries', 'cutthroat', 'Cutthroat', 'mercenary', 30, {
			hiredBy: { factions: ['faction:legion'] }
		}),
		unit('faction:legion', 'heretic', 'Heretic', 'troop', 20),
		unit('faction:court', 'courtier', 'Courtier', 'troop', 20)
	],
	upgrades: [
		{
			id: 'upgrade:order/guard',
			owner: O,
			name: 'Guard',
			keywords: [kw('negate', 'kw:fear')],
			cost: 0,
			currency: 'ducats',
			max: 2
		},
		{
			id: 'upgrade:order/mole',
			owner: O,
			name: 'Trench Mole',
			cost: 10,
			currency: 'ducats',
			max: 3,
			for: [U('trooper')]
		},
		{ id: 'upgrade:order/blessed', owner: O, name: 'Blessed', cost: 2, currency: 'glory' },
		{
			id: 'upgrade:order/wrath',
			owner: O,
			name: 'Wrath of God',
			cost: 5,
			currency: 'ducats',
			limits: [
				{ text: 'Wrath of God: no Ranged Weapons', items: { categories: ['ranged'] }, max: 0 }
			]
		},
		...['hellfire', 'dread', 'speed'].map((id) => ({
			id: `upgrade:order/${id}`,
			owner: U('warlock'),
			name: id[0]!.toUpperCase() + id.slice(1),
			group: 'Goetic Power',
			cost: 5,
			currency: 'ducats' as const,
			for: [U('warlock')]
		}))
	],
	patrons: [
		{
			id: 'patron:saint',
			name: 'Saint Tester, the Patient',
			alignment: 'faithful',
			skills: [
				{
					id: 'skill:saint/procurement',
					name: 'Armour Procurement',
					text: 'Cheaper armour.',
					prices: [{ items: { categories: ['armour'], minCost: 15 }, less: 5 }]
				},
				{
					id: 'skill:saint/melee',
					name: 'Melee Procurement',
					text: 'One model.',
					limits: [
						{
							text: 'Only one model may have Melee Procurement',
							models: { skills: ['skill:saint/melee'] },
							max: 1
						}
					]
				}
			]
		},
		{ id: 'patron:fiend', name: 'Fiend', alignment: 'fallen', skills: [] },
		{
			id: 'patron:gold',
			name: 'Gold Lord',
			factions: ['faction:legion', 'variant:court/greed'],
			skills: []
		}
	],
	tables: [
		{
			id: 'table:trauma',
			name: 'Trauma',
			kind: 'trauma',
			dice: 'D6',
			rows: [
				{
					roll: '1-2',
					name: 'Muscle Damage',
					effects: { limits: [{ items: { keywords: ['kw:heavy'] }, max: 0 }] }
				},
				{ roll: '3-4', name: 'Insomniac', effects: { removeKeywords: ['kw:leader'] } },
				{
					roll: '5-6',
					name: 'Iron Grip',
					effects: { keywords: ['kw:strong'], stats: { melee: 1 } }
				}
			]
		}
	]
};

export const core: RulesSet = rulesSet.parse(input);

/** The core set with more on the Order's rules (limits, prices, caps), for one spec's rule. */
export function withRules(extra: {
	limits?: Limit[];
	prices?: RulesSet['factions'][number]['prices'];
	caps?: { unit: string; max: number }[];
}): RulesSet {
	return rulesSet.parse({
		...core,
		factions: core.factions.map((f) => (f.id === O ? { ...f, ...extra } : f))
	});
}

/** An expansion over the core: one unit replaced by id, one added. */
export const expansion = rulesSet.parse({
	manifest: {
		id: 'test-exp',
		name: 'Test expansion',
		kind: 'expansion',
		version: '1.0',
		base: 'test-core'
	},
	units: [unit(O, 'trooper', 'Trooper', 'troop', 22), unit(O, 'scout', 'Scout', 'troop', 18)]
});
