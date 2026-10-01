export type Alignment = 'faithful' | 'fallen';

export interface Faction {
	id: string;
	name: string;
	alignment: Alignment;
	variants: string[];
	/**
	 * A Carcass Front list that stands in for one of a faction's variants: picked as a sub-faction of `under`, it is a
	 * whole list of its own (units, armoury, rules) with its own variants, and the variant it `replaces` is no longer
	 * offered.
	 */
	under?: string;
	replaces?: string;
	book?: string;
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
		// Procession of the Sacred Affliction is Carcass Front's list now (below).
		variants: ['War Pilgrimage of Saint Methodius', 'Cavalcade of the Tenth Plague']
	},
	{
		id: 'iron-sultanate', name: 'Iron Sultanate', alignment: 'faithful',
		variants: ["Fida'i of Alamut – The Cabal of Assassins", 'The House of Wisdom', 'Defenders of the Iron Wall']
	},
	{
		id: 'heretic-legions', name: 'Heretic Legions', alignment: 'fallen',
		// The Naval Raiding Party is Carcass Front's Heretic Naval Raiders now (below).
		variants: ['Trench Ghosts', 'Knights of Avarice']
	},
	{ id: 'black-grail', name: 'Cult of the Black Grail', alignment: 'fallen', variants: ['Dirge of the Great Hegemon'] },
	{
		id: 'seven-headed-serpent', name: 'Court of the Seven-Headed Serpent', alignment: 'fallen',
		variants: ['Wrath', 'Envy', 'Lust', 'Pride', 'Sloth', 'Gluttony', 'Greed']
	},
	// Carcass Front makes two variants into lists of their own, picked under their faction.
	{
		id: 'procession-of-the-sacred-affliction',
		name: 'Procession of the Sacred Affliction',
		alignment: 'faithful',
		variants: ['The Knights of Saint Lazarus', 'Procession of the Blessed Flock'],
		under: 'trench-pilgrims',
		replaces: 'Procession of the Sacred Affliction',
		book: 'Carcass Front'
	},
	{
		id: 'heretic-naval-raiders',
		name: 'Heretic Naval Raiders',
		alignment: 'fallen',
		variants: ['The Drowned Choir', 'The Leviathan Shoal'],
		under: 'heretic-legions',
		replaces: 'Naval Raiding Party',
		book: 'Carcass Front'
	}
];

/** Carcass Front adds three Patrons. */
export const CF_PATRONS = [
	{ name: 'House of Wisdom', restriction: 'Iron Sultanate only' },
	{ name: 'Blessed Bartolomeo, the Martyr of Leviathan', restriction: 'Faithful only' },
	{ name: 'War Priest Charon, the Apostate of Éire', restriction: 'Fallen only' }
];

/** The sub-factions picked under a faction: Carcass Front's lists that stand in for its variants. */
export const subFactions = (id: string) => FACTIONS.filter((f) => f.under === id);

/** The list that now stands for an old variant (Trench Pilgrims' "Procession…" is Carcass Front's), if any. */
export const replacement = (faction: string, variant: string | null) =>
	variant ? FACTIONS.find((f) => f.under === faction && f.replaces && f.replaces.toLowerCase() === variant.toLowerCase()) : undefined;
