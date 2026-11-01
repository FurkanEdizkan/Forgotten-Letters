/**
 * The invented core set with more for the variant overlay and the armoury sources: a faction limit the variant
 * replaces by name, a replaced upgrade the faction's limit still names, entries the variant adds from another
 * owner, an exploration table's line, a faction line with limits beside a Mercenary pool line, and an item the
 * variant excludes by one of its lines.
 */
import { rulesSet, type RulesSet } from '../../rules/pack.ts';
import { core, U } from './core.ts';

const O = 'faction:order';
const V = 'variant:order/pilgrims';

export const overlay: RulesSet = rulesSet.parse({
	...core,
	items: [
		...core.items.map((i) =>
			i.id === 'item:greatsword' ? { ...i, aliases: ['Great Sword/Axe'] } : i
		),
		{ id: 'item:lamp', name: 'Lamp', category: 'equipment', type: 'Equipment', keywords: [] },
		{ id: 'item:sash', name: 'Sash', category: 'equipment', type: 'Equipment', keywords: [] }
	],
	units: core.units.map((u) => (u.id === U('sergeant') ? { ...u, aliases: ['Sarge'] } : u)),
	armouryLines: [
		...core.armouryLines,
		{
			id: 'line:finds/lamp',
			owner: 'table:finds',
			item: 'item:lamp',
			cost: 0,
			currency: 'ducats',
			stipulations: { explorationOnly: true }
		},
		{
			id: 'line:finds/scope',
			owner: 'table:finds',
			item: 'item:scope',
			cost: 0,
			currency: 'ducats',
			stipulations: { explorationOnly: true }
		},
		{
			id: 'line:glory-items/lamp',
			owner: 'faction:glory-items',
			item: 'item:lamp',
			cost: 1,
			currency: 'glory'
		},
		{
			id: 'line:mercenaries/pistol',
			owner: 'faction:mercenaries',
			item: 'item:pistol',
			cost: 0,
			currency: 'ducats'
		},
		{
			id: 'line:order/sash',
			owner: O,
			item: 'item:sash',
			cost: 5,
			currency: 'ducats',
			// "Guard or ELITE only": two different selector keys, either will do.
			stipulations: {
				only: { any: [{ upgrades: ['upgrade:order/guard'] }, { keywords: ['kw:elite'] }] }
			}
		},
		{
			id: 'line:order/teeth',
			owner: O,
			item: 'item:teeth',
			cost: 1,
			currency: 'ducats',
			stipulations: {
				limits: [{ text: 'Faction Teeth need a Sword', items: { items: ['item:sword'] }, min: 1 }]
			}
		}
	],
	factions: core.factions.map((f) =>
		f.id === 'faction:court'
			? { ...f, requiresVariant: true }
			: f.id === O
				? {
						...f,
						caps: [{ unit: U('trooper'), max: 5 }],
						limits: [
							{
								name: 'Few Hounds',
								text: 'At most 3 Hounds',
								models: { units: [U('hound')] },
								max: 3
							},
							{ text: 'Two Moles at most', models: { upgrades: ['upgrade:order/mole'] }, max: 2 }
						]
					}
				: f
	),
	variants: core.variants.map((v) =>
		v.id === V
			? {
					...v,
					replaces: [
						...(v.replaces ?? []),
						{ from: 'upgrade:order/mole', to: 'upgrade:order/pilgrims/mole' }
					],
					adds: ['unit:legion/heretic', 'upgrade:legion/pact'],
					excludes: [...(v.excludes ?? []), 'line:order/scope']
				}
			: v
	),
	upgrades: [
		...core.upgrades,
		{
			id: 'upgrade:order/pilgrims/mole',
			owner: V,
			name: 'Pilgrim Mole',
			cost: 5,
			currency: 'ducats',
			for: [U('trooper')]
		},
		{
			id: 'upgrade:order/oath',
			owner: O,
			name: 'Oath',
			cost: 0,
			currency: 'ducats',
			afterRecruit: true
		},
		{
			id: 'upgrade:legion/pact',
			owner: 'faction:legion',
			name: 'Dark Pact',
			cost: 0,
			currency: 'ducats'
		}
	],
	tables: [
		...core.tables,
		{
			id: 'table:finds',
			name: 'Finds',
			kind: 'exploration',
			rows: [{ roll: '1-6', name: 'A lamp', links: ['item:lamp'] }]
		}
	]
});
