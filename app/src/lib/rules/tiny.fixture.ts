/** Test data for the rules unit tests: a tiny invented set touching every edge kind. Not used by the app. */
import { rulesSet } from './pack';

export const tiny = () =>
	rulesSet.parse({
		manifest: { id: 'tiny-1.0', name: 'Tiny', kind: 'core', version: '1.0' },
		keywords: [
			{ id: 'kw:brave', name: 'Brave', kind: 'tag', text: 'Like [[kw:calm]].' },
			{ id: 'kw:calm', name: 'Calm', kind: 'tag', text: '' }
		],
		items: [
			{
				id: 'item:pole',
				name: 'Pole',
				category: 'melee',
				type: '2-Handed',
				keywords: [{ kw: 'kw:brave' }]
			},
			{ id: 'item:sling', name: 'Sling', category: 'ranged', type: '1-Handed', keywords: [] }
		],
		armouryLines: [
			{
				id: 'line:reeds/pole',
				owner: 'faction:reeds',
				item: 'item:pole',
				cost: 3,
				currency: 'ducats',
				stipulations: { only: { units: ['unit:reeds/chief'] } }
			}
		],
		factions: [
			{
				id: 'faction:reeds',
				name: 'Reed Folk',
				alignment: 'faithful',
				startDucats: 500,
				startGlory: 0,
				leader: 'unit:reeds/chief',
				mercenaries: ['unit:hired/blade'],
				text: 'Led by [[unit:reeds/chief|a chief]].'
			},
			{ id: 'faction:hired', name: 'Hired', alignment: 'faithful', startDucats: 0, startGlory: 0 }
		],
		variants: [
			{
				id: 'variant:reeds/marsh',
				faction: 'faction:reeds',
				name: 'Marsh',
				replaces: [{ from: 'unit:reeds/poler', to: 'unit:reeds/wader' }],
				adds: ['unit:hired/blade'],
				excludes: ['item:sling']
			}
		],
		units: [
			{
				id: 'unit:reeds/chief',
				owner: 'faction:reeds',
				name: 'Chief',
				category: 'elite',
				availability: { min: 1, max: 1 },
				cost: 50,
				currency: 'ducats',
				stats: {},
				keywords: [{ kw: 'kw:calm' }],
				abilities: [],
				upgrades: ['upgrade:reeds/scarred'],
				kit: {
					fixed: ['item:pole'],
					loadouts: [[['item:sling']]],
					countsAs: 'unit:reeds/poler',
					items: { 'item:sling': { perModel: 1 } }
				}
			},
			{
				id: 'unit:reeds/poler',
				owner: 'faction:reeds',
				name: 'Poler',
				category: 'troop',
				availability: { min: 0, max: null },
				cost: 20,
				currency: 'ducats',
				stats: {},
				keywords: [],
				abilities: [],
				kit: {}
			},
			{
				id: 'unit:reeds/wader',
				owner: 'variant:reeds/marsh',
				name: 'Wader',
				category: 'troop',
				availability: { min: 0, max: null },
				cost: 22,
				currency: 'ducats',
				stats: {},
				keywords: [],
				abilities: [],
				kit: {}
			},
			{
				id: 'unit:hired/blade',
				owner: 'faction:hired',
				name: 'Blade',
				category: 'mercenary',
				availability: { min: 0, max: 1 },
				cost: 60,
				currency: 'ducats',
				stats: {},
				keywords: [],
				abilities: [],
				kit: {},
				hiredBy: { factions: ['faction:reeds'] }
			}
		],
		upgrades: [
			{
				id: 'upgrade:reeds/scarred',
				owner: 'faction:reeds',
				name: 'Scarred',
				cost: 1,
				currency: 'glory',
				for: ['unit:reeds/chief']
			}
		],
		patrons: [
			{
				id: 'patron:heron',
				name: 'Heron',
				factions: ['faction:reeds'],
				skills: [{ id: 'skill:heron/still', name: 'Still', text: 'Wait.' }]
			}
		],
		tables: [
			{
				id: 'table:mud',
				name: 'Mud',
				kind: 'trauma',
				owner: 'faction:reeds',
				rows: [{ roll: '1', name: 'Stuck', links: ['item:sling'] }]
			}
		],
		pages: [
			{ id: 'page:a', section: 'core-rules', title: 'A', order: 1, body: 'See [[table:mud#1]].' },
			{ id: 'page:a/b', section: 'core-rules', title: 'B', order: 2, parent: 'page:a', body: '' }
		]
	});
