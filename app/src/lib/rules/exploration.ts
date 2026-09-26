import type { Effect, Resource } from './types';

export interface TableRow {
	min: number;
	/** Inclusive; Infinity for the top "34+" row. */
	max: number;
	name: string;
	summary: string;
	/** Effects that always apply; choices (Glory items, CVP trades) are added by the CM. */
	effects?: Effect[];
}

const row = (min: number, max: number, name: string, summary: string, effects?: Effect[]): TableRow => ({
	min,
	max,
	name,
	summary,
	effects
});
const fill = (track: Resource): Effect => ({ t: 'fill', track });
const TOP = Infinity;

/** Short summaries from the Player's Guide §12 — check the book for full wording. */
export const EXPLORATION_TABLES: Record<Resource, TableRow[]> = {
	F: [
		row(1, 3, 'Shaken', '+R, +S or +T; one non-Elite rolls as if in the Trauma Step'),
		row(4, 5, 'Trench Shrine', 'Troop Flag, Field Shrine, or +2 Glory'),
		row(6, 9, 'Rival Icon', 'Trade up to 2 Glory for CVP'),
		row(10, 12, 'Fallen Knight', 'Reinforced Armour, Combat Helmet and Great Sword, or +2 Glory'),
		row(13, 15, 'Duelling Grounds', '+F; two non-Elites duel; winner may be Promoted; loser removed on 1–4', [fill('F')]),
		row(16, 17, 'Ruined Church', '+4 Glory, or a Glory Item up to 10'),
		row(18, 20, 'Ritual Sacrifice', 'Trade up to 5 Glory for CVP'),
		row(21, 22, "Patron's Reliquary", "+2 F and a Patron's Relic (Elite gains TOUGH)", [fill('F'), fill('F')]),
		row(23, 25, 'Failed Communicant Vat', 'Faithful: Communicant Vat. Fallen: Failed Saviour'),
		row(26, 29, "Lock of Samson's Hair", 'STRONG and +1 Injury Dice in melee'),
		row(30, 33, "Patron's Visit", 'Trade up to 10 Glory for CVP'),
		row(34, TOP, 'Chosen Blessing', 'Most experienced model gains any Skill (or 2 Patron Skills)')
	],
	R: [
		row(1, 3, 'Mugged', '+F, +S or +T; lose 20 Ducats'),
		row(4, 5, 'Airship Wreckage', 'A HEAVY Battlekit, or a Glory Item up to 5'),
		row(6, 8, 'Ruined Apocrypha', '+2 CVP if you already hold another Apocrypha', [{ t: 'apocrypha', n: 1 }]),
		row(9, 11, 'Angelic Instrument', 'Musical Instrument with 8" range'),
		row(12, 13, 'Alchemist Workshop', '+R and Curative Fluids (remove 1 Battle Scar once)', [fill('R')]),
		row(14, 15, 'Stylite Tower', 'Faction sniper kit'),
		row(16, 17, 'Book of Golems', 'A free Golem (Takwin Homunculus)'),
		row(18, 20, 'Tarnished Apocrypha', '+5 CVP if you already hold another Apocrypha', [{ t: 'apocrypha', n: 1 }]),
		row(21, 22, 'Esoteric Library', '+2 R; Burn, Release Plague, Sell (6D6×10 Ducats) or Study', [fill('R'), fill('R')]),
		row(23, 25, 'Tank God Cultists', 'Dum-Dum access, 150 Ducats or 5 Glory'),
		row(26, 29, 'Treasure of the Holies', 'Any one Glory Item'),
		row(30, 33, 'Preserved Apocrypha', '+10 CVP if you already hold another Apocrypha', [{ t: 'apocrypha', n: 1 }]),
		row(34, TOP, 'Divine Shards', '2 armours gain NEGATE FIRE, GAS, SHRAPNEL — or +15 Glory')
	],
	S: [
		row(1, 3, 'Pillaged', '+F, +R or +T; one model starts next game with 2 Blood Markers'),
		row(4, 5, 'Stalled Corpse Carriage', 'Morale dice, Elite XP, or 30 Ducats'),
		row(6, 8, 'Ruined House', 'Equipment up to 30, Glory Item up to 7, or 2 CVP'),
		row(9, 11, 'Fallen Pilgrim', 'Melee weapon and Standard Armour; maybe a kit on 4+'),
		row(12, 13, 'Killzone', '+2 Glory (Faithful), Trench Dog, or Elite XP (Fallen)'),
		row(14, 15, 'Breaker King Tithe', '+S; 10 Ducats every Exploration Step', [fill('S')]),
		row(16, 17, 'Battlefield of Corpses', 'Up to 2 Battlekit worth up to 100'),
		row(18, 20, 'Deserted Camp', 'Battlekit up to 120, Glory Items up to 9, or 5 CVP'),
		row(21, 22, 'Suspicious Convoy', '+2 S; morale bonus, 120 Ducats, or +4 Glory (Fallen)', [fill('S'), fill('S')]),
		row(23, 25, 'Orichalcum Crucible', 'AP melee weapons, IMPERVIOUS shields, or 100 Ducats + 2 Glory'),
		row(26, 29, 'Resurrection Machines', 'Salvaged Resurrection Machine'),
		row(30, 33, 'Goldflesh Merchant', 'Aurum Shroud, or 10 CVP'),
		row(34, TOP, 'Vivarium Vial', 'Imbibe, Distil (2 models STRONG), or +10 Glory (Fallen)')
	],
	T: [
		row(1, 3, 'Lost', "+F, +R or +S; -1 DICE on each model's first Dash next game"),
		row(4, 5, 'Scout Report', '±1 to Exploration Rolls for the rest of the campaign', [{ t: 'rollMod' }]),
		row(6, 8, 'Survivor', 'A free basic model for your faction'),
		row(9, 11, 'Unsettling Merchant', 'All may buy Glory Items up to 5; you gain 2 CVP', [{ t: 'merchant', tier: 5 }, { t: 'cvp', n: 2 }]),
		row(12, 13, 'Scarred Wanderer', '+T and the Re-roll Exploration Skill', [fill('T'), { t: 'reroll' }]),
		row(14, 15, 'Whispers in the Mud', 'Extra Dice Exploration Skill, or +2 Glory'),
		row(16, 18, 'Silk Road Traders', 'All may buy Glory Items up to 8; you gain 5 CVP', [{ t: 'merchant', tier: 8 }, { t: 'cvp', n: 5 }]),
		row(19, 20, 'Second Shadow', 'Duplicate Exploration Skill, or Sharp Eyes for an Elite'),
		row(21, 22, 'Personnel Carrier', '+2 T; attack zones up to 2 away', [fill('T'), fill('T'), { t: 'reach2' }]),
		row(23, 25, 'High-Ranking Captive', '100 Ducats, +4 Glory, Glory Item up to 8, or Set Dice Skill'),
		row(26, 29, 'Sworn Sword', 'A free Mercenary (or non-Leader Elite)'),
		row(30, 33, 'Envoy of the Merchant Princes', 'All may buy Glory Items up to 12; you gain 10 CVP', [{ t: 'merchant', tier: 12 }, { t: 'cvp', n: 10 }]),
		row(34, TOP, 'The Knife of God', 'A Sacred Cannonade')
	]
};

export function lookup(table: Resource, total: number): TableRow {
	const rows = EXPLORATION_TABLES[table];
	return rows.find((r) => total >= r.min && total <= r.max) ?? rows[0];
}

/** Defender with three or more matching dice meets agents of Rudolf's Folly. */
export function follyOffer(dice: number[]): boolean {
	const counts = new Map<number, number>();
	for (const d of dice) counts.set(d, (counts.get(d) ?? 0) + 1);
	return [...counts.values()].some((c) => c >= 3);
}

export const lootFor = (total: number) => total * 5;
