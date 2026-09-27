export type Alignment = 'faithful' | 'fallen';

export interface Faction {
	id: string;
	name: string;
	alignment: Alignment;
	variants: string[];
}

/** Warbands of Trench Crusade v1.0.2. */
export const FACTIONS: Faction[] = [
	{
		id: 'new-antioch', name: 'Principality of New Antioch', alignment: 'faithful',
		variants: [
			'Papal States Intervention Force', 'Éire Rangers', 'Kingdom of Alba Assault Detachment',
			'Stosstruppen of the Free State of Prussia', 'Expeditionary Forces of Abyssinia'
		]
	},
	{
		id: 'trench-pilgrims', name: 'Trench Pilgrims', alignment: 'faithful',
		variants: ['Procession of the Sacred Affliction', 'War Pilgrimage of Saint Methodius', 'Cavalcade of the Tenth Plague']
	},
	{
		id: 'iron-sultanate', name: 'Iron Sultanate', alignment: 'faithful',
		variants: ["Fida'i of Alamut – The Cabal of Assassins", 'The House of Wisdom', 'Defenders of the Iron Wall']
	},
	{
		id: 'heretic-legions', name: 'Heretic Legions', alignment: 'fallen',
		variants: ['Trench Ghosts', 'Knights of Avarice', 'Naval Raiding Party']
	},
	{ id: 'black-grail', name: 'Cult of the Black Grail', alignment: 'fallen', variants: ['Dirge of the Great Hegemon'] },
	{
		id: 'seven-headed-serpent', name: 'Court of the Seven-Headed Serpent', alignment: 'fallen',
		variants: ['Wrath', 'Envy', 'Lust', 'Pride', 'Sloth', 'Gluttony', 'Greed']
	},
	// Carcass Front makes two variants into factions of their own.
	{ id: 'procession-of-the-sacred-affliction', name: 'Procession of the Sacred Affliction', alignment: 'faithful', variants: [] },
	{ id: 'heretic-naval-raiders', name: 'Heretic Naval Raiders', alignment: 'fallen', variants: [] }
];

/** Carcass Front adds three Patrons. */
export const CF_PATRONS = [
	{ name: 'House of Wisdom', restriction: 'Iron Sultanate only' },
	{ name: 'Blessed Bartolomeo, the Martyr of Leviathan', restriction: 'Faithful only' },
	{ name: 'War Priest Charon, the Apostate of Éire', restriction: 'Fallen only' }
];
