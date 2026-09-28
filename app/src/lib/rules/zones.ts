import type { Zone } from './types';

/** The Carcass Front map image the preset's normalised anchors were measured on. */
export const MAP_SIZE = { w: 1199, h: 802 };
const px = (x: number, y: number) => ({ x: x / MAP_SIZE.w, y: y / MAP_SIZE.h });

const OMEN_FIRST = 'The first player to place an Outpost here gains 1 Omen of Leviathan.';

/**
 * Zones printed on the Carcass Front map (names per the map's Zones table).
 * Links are listed from each zone's side; `buildGraph` makes them symmetric.
 */
const BOOK_ZONES: Zone[] = [
	{ id: 'A', name: 'Blighted Ruins', type: 'entry', resources: [], links: ['domus-demetrius', 'sacred-plains'], pos: px(445, 72) },
	{ id: 'B', name: 'Derelict Port', type: 'entry', resources: [], links: ['sword-of-god', 'syrian-gate'], pos: px(98, 412) },
	{ id: 'C', name: 'Ancient Railway', type: 'entry', resources: [], links: ['basarfuth-castle', 'ruins-of-nineveh-novus'], pos: px(715, 460) },
	{ id: 'D', name: 'Secluded Tunnels', type: 'entry', resources: [], links: ['guillaume-basin', 'steel-necropolis'], pos: px(240, 758) },

	{
		id: 'altar-of-leviathan', name: 'Altar of Leviathan', type: 'special', resources: ['F', 'R', 'S'],
		scenario: 'Altar of Leviathan',
		bonus: 'Special rules apply to games here. Only as both players’ last game, and only if both hold at least 1 Omen of Leviathan.',
		links: ['milya-outskirts', 'carrion-coast'], pos: px(205, 245)
	},
	{
		id: 'baghras-fortress', name: 'Baghras Fortress', type: 'special', resources: ['R', 'T'],
		scenario: 'Fields of Glory',
		bonus: 'In the next Quartermaster Step, Mercenaries cost half their Glory (rounded up).',
		links: ['syrian-gate', 'risen-ruins'], pos: px(220, 640)
	},
	{
		id: 'basarfuth-castle', name: 'Basarfuth Castle', type: 'basic', resources: ['R', 'S'], scenario: 'Supply Raid',
		links: ['kyrrhos-city', 'fields-of-green-flame', 'lost-shih-al-hadid', 'scavenger-town', 'C', 'ruins-of-nineveh-novus'], pos: px(620, 550)
	},
	{ id: 'botfly-valley', name: 'Botfly Valley', type: 'basic', resources: ['R'], archetype: 'trench-lines', links: ['domus-demetrius', 'milya-outskirts'], pos: px(290, 170) },
	{
		id: 'carrion-coast', name: 'Carrion Coast', type: 'basic', resources: ['F'], archetype: 'derelict-ruins',
		links: ['altar-of-leviathan', 'milya-outskirts', 'holy-choked-path', 'pillar-of-jonah'], pos: px(262, 340)
	},
	{
		id: 'cathedral-of-wire', name: 'Cathedral of Wire', aliases: ['Mosque of Wire'], type: 'basic', resources: ['R'], archetype: 'derelict-ruins',
		links: ['holy-choked-path', 'north-amanus-trenches', 'shadow-of-old-saints', 'vivarium', 'fields-of-green-flame'], pos: px(530, 365)
	},
	{
		id: 'desolate-trapesac', name: 'Desolate Trapesac', type: 'basic', resources: ['S'], archetype: 'no-mans-land',
		links: ['pillar-of-jonah', 'holy-choked-path', 'vivarium', 'south-amanus-trenches', 'geist-spires'], pos: px(345, 465)
	},
	{
		id: 'domus-demetrius', name: 'Domus Demetrius', type: 'special', resources: ['F', 'S', 'T'], scenario: 'Domus Demetrius',
		bonus: `${OMEN_FIRST} The Outpost counts as 2 zones for the Largest Enclave.`, omen: 'first', enclaveWeight: 2,
		links: ['A', 'botfly-valley', 'sacred-plains', 'milya-outskirts', 'holy-choked-path', 'north-amanus-trenches'], pos: px(393, 170)
	},
	{
		id: 'fields-of-green-flame', name: 'Fields of Green Flame', type: 'basic', resources: ['S'], archetype: 'trench-lines',
		links: ['shadow-of-old-saints', 'cathedral-of-wire', 'kyrrhos-city', 'vivarium', 'lost-shih-al-hadid', 'basarfuth-castle'], pos: px(590, 450)
	},
	{
		id: 'geist-spires', name: 'Geist Spires', type: 'basic', resources: ['S', 'T'], scenario: 'Supply Raid',
		links: ['desolate-trapesac', 'vivarium', 'south-amanus-trenches', 'guillaume-basin', 'lost-shih-al-hadid', 'little-jahannam'], pos: px(415, 550)
	},
	{
		id: 'guillaume-basin', name: 'Guillaume Basin', type: 'basic', resources: ['T'], archetype: 'trench-lines',
		links: ['south-amanus-trenches', 'geist-spires', 'little-jahannam', 'D', 'steel-necropolis'], pos: px(345, 625)
	},
	{
		id: 'holy-choked-path', name: 'Holy Choked Path', type: 'basic', resources: ['F', 'T'], scenario: "Claim No Man's Land",
		links: ['milya-outskirts', 'domus-demetrius', 'carrion-coast', 'north-amanus-trenches', 'cathedral-of-wire', 'vivarium', 'desolate-trapesac', 'pillar-of-jonah'], pos: px(370, 370)
	},
	{
		id: 'house-of-pillars', name: 'House of Pillars', type: 'special', resources: ['R', 'S'], scenario: 'Relic Hunt',
		bonus: '+1 DICE to Morale Check Success Rolls.',
		links: ['sacred-plains', 'pilgrimage-of-stone'], pos: px(575, 80)
	},
	{
		id: 'kurd-dagh', name: 'Kurd Dagh', type: 'special', resources: ['F', 'R', 'T'], scenario: 'The High Ground',
		bonus: 'Re-roll 1 Promotion roll in each Promotions & Experience Step.',
		links: ['pilgrimage-of-stone', 'shadow-of-old-saints', 'kyrrhos-city'], pos: px(705, 250)
	},
	{
		id: 'kyrrhos-city', name: 'Kyrrhos City', aliases: ['Kyrros City'], type: 'basic', resources: ['F'], archetype: 'no-mans-land',
		links: ['kurd-dagh', 'shadow-of-old-saints', 'fields-of-green-flame', 'basarfuth-castle'], pos: px(665, 365)
	},
	{
		id: 'little-jahannam', name: 'Little Jahannam', type: 'basic', resources: ['R'], archetype: 'derelict-ruins',
		links: ['geist-spires', 'guillaume-basin', 'lost-shih-al-hadid', 'martyrs-crossing', 'steel-necropolis'], pos: px(445, 650)
	},
	{
		id: 'lost-shih-al-hadid', name: 'Lost Shih-al-Hadid', type: 'basic', resources: ['T'], archetype: 'no-mans-land',
		links: ['vivarium', 'fields-of-green-flame', 'geist-spires', 'little-jahannam', 'martyrs-crossing', 'basarfuth-castle'], pos: px(515, 580)
	},
	{
		id: 'martyrs-crossing', name: "Martyr's Crossing", type: 'basic', resources: ['F', 'S'], scenario: "Claim No Man's Land",
		links: ['little-jahannam', 'lost-shih-al-hadid', 'scavenger-town'], pos: px(545, 680)
	},
	{
		id: 'milya-outskirts', name: "Mi'ilya Outskirts", aliases: ['Milya Outskirts'], type: 'basic', resources: ['T'], archetype: 'no-mans-land',
		links: ['botfly-valley', 'domus-demetrius', 'altar-of-leviathan', 'carrion-coast', 'holy-choked-path'], pos: px(325, 265)
	},
	{
		id: 'north-amanus-trenches', name: 'North Amanus Trenches', type: 'basic', resources: ['F'], archetype: 'trench-lines',
		links: ['domus-demetrius', 'sacred-plains', 'shadow-of-old-saints', 'holy-choked-path', 'cathedral-of-wire'], pos: px(440, 305)
	},
	{
		id: 'pilgrimage-of-stone', name: 'Pilgrimage of Stone', type: 'basic', resources: ['S'], archetype: 'no-mans-land',
		links: ['house-of-pillars', 'sacred-plains', 'shadow-of-old-saints', 'kurd-dagh'], pos: px(625, 175)
	},
	{
		id: 'pillar-of-jonah', name: 'Pillar of Jonah', type: 'special', resources: ['R', 'S', 'T'], scenario: 'Trench Warfare',
		bonus: 'In games here or in a linked zone, your opponent starts with 2 BLOOD MARKERS (both ways if both players hold an Outpost here).',
		links: ['carrion-coast', 'holy-choked-path', 'desolate-trapesac'], pos: px(215, 425)
	},
	{ id: 'risen-ruins', name: 'Risen Ruins', type: 'basic', resources: ['R'], archetype: 'derelict-ruins', links: ['sword-of-god', 'baghras-fortress'], pos: px(105, 675) },
	{
		id: 'ruins-of-nineveh-novus', name: 'Ruins of Nineveh Novus', type: 'special', resources: ['F', 'R', 'T'], scenario: 'Ruins of Nineveh Novus',
		bonus: `${OMEN_FIRST} You can add or subtract 1 from Exploration Rolls.`, omen: 'first',
		links: ['C', 'basarfuth-castle', 'scavenger-town'], pos: px(750, 570)
	},
	{
		id: 'sacred-plains', name: 'Sacred Plains', type: 'basic', resources: ['R'], archetype: 'no-mans-land',
		links: ['A', 'house-of-pillars', 'domus-demetrius', 'pilgrimage-of-stone', 'north-amanus-trenches', 'shadow-of-old-saints'], pos: px(520, 180)
	},
	{
		id: 'scavenger-town', name: 'Scavenger Towns', aliases: ['Scavenger Town'], type: 'basic', resources: ['S'], scenario: "Claim No Man's Land",
		links: ['martyrs-crossing', 'basarfuth-castle', 'ruins-of-nineveh-novus'], pos: px(630, 650)
	},
	{
		id: 'shadow-of-old-saints', name: 'Shadow of Old Saints', type: 'basic', resources: ['F', 'R'], scenario: 'Hunt for Heroes',
		links: ['sacred-plains', 'pilgrimage-of-stone', 'kurd-dagh', 'north-amanus-trenches', 'cathedral-of-wire', 'fields-of-green-flame', 'kyrrhos-city'], pos: px(565, 270)
	},
	{
		id: 'south-amanus-trenches', name: 'South Amanus Trenches', type: 'basic', resources: ['F', 'T'], scenario: 'Hunt for Heroes',
		links: ['syrian-gate', 'desolate-trapesac', 'geist-spires', 'guillaume-basin'], pos: px(305, 555)
	},
	{
		id: 'steel-necropolis', name: 'Steel Necropolis', type: 'special', resources: ['F', 'S', 'T'], scenario: 'Steel Necropolis',
		bonus: `In the next Quartermaster Step, Armour and Shields cost half price in Ducats. ${OMEN_FIRST}`, omen: 'first',
		links: ['D', 'guillaume-basin', 'little-jahannam'], pos: px(375, 740)
	},
	{
		id: 'syrian-gate', name: 'Syrian Gate', type: 'basic', resources: ['T'], archetype: 'no-mans-land',
		links: ['B', 'sword-of-god', 'south-amanus-trenches', 'baghras-fortress'], pos: px(210, 545)
	},
	{
		id: 'sword-of-god', name: 'The Sword of God', type: 'special', resources: ['F', 'S', 'T'], scenario: 'The Sword of God',
		bonus: `In the next Quartermaster Step, Ranged Weapons cost half price in Ducats. ${OMEN_FIRST}`, omen: 'first',
		links: ['B', 'syrian-gate', 'risen-ruins'], pos: px(100, 545)
	},
	{
		id: 'vivarium', name: 'The Vivarium', type: 'special', resources: ['F', 'R', 'S'], scenario: 'Dragon Hunt',
		bonus: 'Re-roll 1 Trauma roll in each Outcome Phase.',
		links: ['holy-choked-path', 'cathedral-of-wire', 'desolate-trapesac', 'fields-of-green-flame', 'geist-spires', 'lost-shih-al-hadid'], pos: px(470, 440)
	}
];

/** Our campaign's additions for sixteen players (Player's Guide §3 and §13). All play Random. */
const HOUSE_ZONES: Zone[] = [
	{
		id: 'E', name: 'The Drowned Anchorage', type: 'entry', resources: [], house: true,
		links: ['amoudet-seawall', 'altar-of-leviathan'], pos: px(52, 300)
	},
	{
		id: 'F', name: 'The Salt Caravan Road', type: 'entry', resources: [], house: true,
		links: ['ruins-of-nineveh-novus', 'scavenger-town', 'corpse-rail-terminus'], pos: px(800, 702)
	},
	{
		id: 'rudolfs-folly', name: "Rudolf's Folly", type: 'special', resources: ['R', 'T'], archetype: 'no-mans-land', house: true,
		bonus: 'Once per campaign, an Aerial Bombardment or Strafing Run at no Glory cost.',
		links: ['house-of-pillars', 'pilgrimage-of-stone', 'kurd-dagh'], pos: px(745, 178)
	},
	{
		id: 'hermits-stair', name: "Hermit's Stair", type: 'basic', resources: ['F'], archetype: 'no-mans-land', house: true,
		links: ['A', 'botfly-valley', 'domus-demetrius'], pos: px(360, 62)
	},
	{
		id: 'amoudet-seawall', name: 'Amoudet Seawall', type: 'special', resources: ['F', 'T'], archetype: 'no-mans-land', house: true,
		bonus: 'Gain 1 Omen of Leviathan.', omen: 'each',
		links: ['E', 'B', 'carrion-coast', 'pillar-of-jonah'], pos: px(148, 338)
	},
	{
		id: 'stylite-row', name: 'The Stylite Row', type: 'basic', resources: ['F', 'S'], archetype: 'no-mans-land', house: true,
		links: ['kurd-dagh', 'kyrrhos-city', 'C'], pos: px(778, 392)
	},
	{
		id: 'corpse-rail-terminus', name: 'Corpse Rail Terminus', type: 'basic', resources: ['S', 'R'], archetype: 'no-mans-land', house: true,
		links: ['martyrs-crossing', 'scavenger-town', 'F'], pos: px(612, 770)
	},
	{
		id: 'melessin-causeway', name: 'Melessin Causeway', type: 'basic', resources: ['S', 'T'], archetype: 'no-mans-land', house: true,
		links: ['risen-ruins', 'D'], pos: px(62, 772)
	}
];

export interface ZoneGraph {
	zones: Map<string, Zone>;
	adj: Map<string, Set<string>>;
}

/** The Carcass Front map's zones and our house additions: the preset a new campaign starts from. */
export const PRESET_ZONES: Zone[] = [...BOOK_ZONES, ...HOUSE_ZONES];
export const BOOK_ZONE_IDS = new Set(BOOK_ZONES.map((z) => z.id));

/**
 * The campaign's zones as placed in the Map Studio. Replaced in place (setZones) when they are loaded or edited,
 * so every module that imports it sees the current map. Starts as the preset.
 */
export const ALL_ZONES: Zone[] = [...PRESET_ZONES];

export function setZones(list: Zone[]) {
	ALL_ZONES.splice(0, ALL_ZONES.length, ...list);
}

/** The zones and their (symmetric) links; `houseZones` off leaves out the zones marked as house additions. */
export function buildGraph(houseZones = true): ZoneGraph {
	const list = houseZones ? ALL_ZONES : ALL_ZONES.filter((z) => !z.house);
	const zones = new Map(list.map((z) => [z.id, z]));
	const adj = new Map<string, Set<string>>(list.map((z) => [z.id, new Set<string>()]));
	for (const z of list) {
		for (const l of z.links) {
			if (!zones.has(l)) continue;
			adj.get(z.id)!.add(l);
			adj.get(l)!.add(z.id);
		}
	}
	return { zones, adj };
}
