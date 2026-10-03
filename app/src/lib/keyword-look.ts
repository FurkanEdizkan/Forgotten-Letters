/**
 * How a keyword's chip looks: its kind, shown as a drawn mark and (on the warband pages' dark register) a
 * coloured edge. A keyword's own `look` (set in the keyword library) wins; otherwise it is read from its name.
 */
import { keywordKey } from './keywords';

export type Look = 'bonus' | 'attack' | 'kit' | 'harm' | 'body' | 'ground' | 'tag';

export const LOOKS: Record<Look, string> = {
	bonus: 'Dice and modifiers',
	attack: 'Attack',
	kit: 'Handling',
	harm: 'Markers and dread',
	body: 'Nature',
	ground: 'Ground',
	tag: 'Tag'
};

/** By the keyword's glossary key, or the first word of a family ("IGNORE COVER" → IGNORE). */
const BY_NAME: Record<string, Look> = {
	DICE: 'bonus',
	'INJURY DICE': 'bonus',
	'INJURY MODIFIER': 'bonus',
	BLESSED: 'bonus',
	ASSAULT: 'attack',
	AUTOMATIC: 'attack',
	BLAST: 'attack',
	CLEAVE: 'attack',
	CRITICAL: 'attack',
	DEADLY: 'attack',
	FIRE: 'attack',
	GAS: 'attack',
	SHRAPNEL: 'attack',
	'ARMOUR PIERCING': 'attack',
	IGNORE: 'attack',
	FLAMETHROWER: 'attack',
	SCATTER: 'attack',
	PISTOL: 'attack',
	SHOTGUN: 'attack',
	AMMUNITION: 'attack',
	RISKY: 'attack',
	RELOAD: 'attack',
	HEAVY: 'kit',
	CUMBERSOME: 'kit',
	CONSUMABLE: 'kit',
	HELD: 'kit',
	DEPLOYABLE: 'kit',
	BLOCK: 'kit',
	'SHIELD COMBO': 'kit',
	'BAYONET LUG': 'kit',
	'OFF HAND': 'kit',
	HEADGEAR: 'kit',
	FEAR: 'harm',
	MINED: 'harm',
	TOUGH: 'body',
	STRONG: 'body',
	ARTIFICIAL: 'body',
	DEMONIC: 'body',
	FLYING: 'body',
	GOLEM: 'body',
	IMPERVIOUS: 'body',
	INFILTRATOR: 'body',
	REGENERATE: 'body',
	SKIRMISHER: 'body',
	FIRETEAM: 'body',
	LEADER: 'body',
	NEGATE: 'body',
	COVER: 'ground'
};

export function lookOf(keyword: string, set?: Record<string, string | null | undefined>): Look {
	const key = keywordKey(keyword);
	const own = set?.[key] ?? set?.[key.split(' ')[0]];
	if (own && own in LOOKS) return own as Look;
	const named = BY_NAME[key] ?? BY_NAME[key.replace(/^[+-]?\d*\s*/, '')] ?? BY_NAME[key.split(' ')[0]];
	if (named) return named;
	if (/MARKER/.test(key)) return 'harm';
	if (/TERRAIN/.test(key)) return 'ground';
	if (/DICE|MODIFIER/.test(key)) return 'bonus';
	return 'tag';
}

/** "IGNORE COVER" → "Ignore Cover", "BLAST 3\"" → "Blast 3\"", "+1 DICE" → "+1 Dice". */
export const titleCase = (k: string) => k.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_, a, b) => a + b.toUpperCase());
