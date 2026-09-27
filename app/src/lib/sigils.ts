/**
 * Faction sigil light: the colours that rise through each warband's symbol,
 * bottom to top, on the map and wherever the symbol is shown.
 */
export interface Sigil {
	/** Light at the foot of the rise. */
	low: string;
	/** Light at the crest. */
	high: string;
	/** The badge rim's metal or pigment. */
	rim: string;
	/** Gilded rim with filigree studs (the Iron Sultanate's gold). */
	filigree?: boolean;
}

export const SIGILS: Record<string, Sigil> = {
	// Sacred light: gold rising into white.
	'new-antioch': { low: '#d9a62e', high: '#fff4d6', rim: '#b98a2c' },
	// Candle amber rising into blood.
	'trench-pilgrims': { low: '#f0a23a', high: '#c8231a', rim: '#6e1a12' },
	// Jabirean alchemy: violet rising into green, set in gold.
	'iron-sultanate': { low: '#8a3fd1', high: '#4fd67a', rim: '#d4a73a', filigree: true },
	// Hellfire.
	'heretic-legions': { low: '#b3160c', high: '#ff8a2a', rim: '#3a0d08' },
	// Plague murk rising into bile.
	'black-grail': { low: '#3d4a14', high: '#c9d64a', rim: '#1d2408' },
	// Crimson rising into rose-gold.
	'seven-headed-serpent': { low: '#9e1030', high: '#f2b48c', rim: '#7a2a1c' }
};

/** House or unknown factions: bone light. */
export const BONE_SIGIL: Sigil = { low: '#8f8570', high: '#ece5d3', rim: '#4a4032' };

export const sigilFor = (faction: string | null | undefined): Sigil =>
	(faction && SIGILS[faction]) || BONE_SIGIL;

export const hexToNumber = (hex: string) => parseInt(hex.slice(1), 16);
