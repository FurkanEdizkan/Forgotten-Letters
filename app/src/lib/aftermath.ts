/**
 * A warband's aftermath after a battle, by the Rulebook's Campaign Phase: the Trauma Step (Troops make a Survival
 * Roll, ELITE models roll on the Trauma Table), Promotions (a pool of dice handed to the Troops), Experience (1 for
 * each ELITE model that survived, a second for one that did a Glorious Deed) and Advancement Rolls on the Skill
 * Tables. Every roll is made once, by the server, and kept on the report; the Campaign Master approves it.
 */
import { advancementsDue, assignPromotionDice, effectsOf, roll, rollPromotions, rowFor, skillFrom, type CampaignTable, type Progression } from './progression';
import type { ItemSel } from './warband-limits';

export interface RolledResult {
	dice: number[];
	total: number;
	result: string;
	text: string;
	dead?: boolean;
	retire?: boolean;
	missNext?: boolean;
	extraXp?: number | string;
}

export interface Advancement {
	/** The Skill Tables picked (ids). */
	tables: string[];
	rolls: { table: string; dice: number[]; total: number; skill: string | null; text: string }[];
	/** The skill taken, one of the rolls'. */
	chosen: string | null;
}

export interface AftermathModel {
	unitId: string;
	name: string;
	type: string;
	elite: boolean;
	outOfAction: boolean;
	/** Glorious Deeds it carried out. */
	deeds: number;
	trauma?: RolledResult;
	promotion?: { dice: number[]; promoted: boolean };
	/** Experience gained this game. */
	xp: number;
	advancements: Advancement[];
}

export interface AftermathLines {
	models: AftermathModel[];
	promotion: { pool: number; rolled: boolean; streakAfter: number | null };
	income: { ducats: number; glory: number };
	notes: string;
}

/** The roster facts a report reads. */
export interface UnitFacts {
	id: string;
	name: string;
	type: string;
	category: 'elite' | 'troop' | 'mercenary';
	keywords: string[];
	experience: number;
	skills: string[];
	injuries: string[];
	/** Advancement Rolls already made (its skills taken by advancement). */
	advancementsMade: number;
	/** It can no longer gain Experience (an injury says so). */
	noExperience: boolean;
}

const isElite = (u: Pick<UnitFacts, 'category' | 'keywords'>) => u.category === 'elite' || u.keywords.some((k) => k.toUpperCase() === 'ELITE');

/** A fresh report: each active model, not yet marked. */
export function newReport(units: UnitFacts[]): AftermathLines {
	return {
		models: units.map((u) => ({ unitId: u.id, name: u.name, type: u.type, elite: isElite(u), outOfAction: false, deeds: 0, xp: 0, advancements: [] })),
		promotion: { pool: 0, rolled: false, streakAfter: null },
		income: { ducats: 0, glory: 0 },
		notes: ''
	};
}

/** Roll the Trauma Step for a model taken Out of Action: a Survival Roll for a Troop, the Trauma Table for ELITE. */
export function rollTrauma(m: AftermathModel, tables: { survival?: CampaignTable; trauma?: CampaignTable }, d6: () => number): RolledResult | null {
	const t = m.elite ? tables.trauma : tables.survival;
	if (!t || !m.outOfAction || m.trauma) return null;
	const r = roll(t.dice, d6);
	const row = rowFor(t, r.total);
	return {
		dice: r.dice,
		total: r.total,
		result: row?.name ?? '?',
		text: row?.text ?? '',
		...(row?.effects?.dead ? { dead: true } : {}),
		...(row?.effects?.retire ? { retire: true } : {}),
		...(row?.effects?.miss_next_battle ? { missNext: true } : {}),
		// "D3 extra Experience" is rolled now, with the rest, so the report holds a number.
		...(row?.effects?.extra_xp != null ? { extraXp: typeof row.effects.extra_xp === 'number' ? row.effects.extra_xp : /^d3$/i.test(row.effects.extra_xp) ? Math.ceil(d6() / 2) : 0 } : {})
	};
}

/** Whether a model is still with the warband after the Trauma Step. */
const survives = (m: AftermathModel) => !m.trauma?.dead && !m.trauma?.retire;

/**
 * Roll Promotions: 1 die (`baseDice`) and one per Glorious Deed, handed to the surviving Troops evenly; at most
 * `maxElite` ELITE models after it. Marks the promoted models ELITE in the report.
 */
/** `extraDice`: dice skills add to the pool (Show Off); `eliteNow` leaves out models that don't count (Bad Company). */
export function rollPromotionStep(r: AftermathLines, p: Progression, eliteNow: number, streak: number, d6: () => number, extraDice = 0, asTroops: string[] = []): AftermathLines {
	if (r.promotion.rolled) return r;
	const deeds = r.models.reduce((s, m) => s + m.deeds, 0);
	const pool = p.promotion.baseDice + deeds * p.promotion.perGloriousDeed + extraDice;
	// ELITE models that can no longer gain Experience (Head Wound) take Promotion Dice as if they were Troops.
	const troops = r.models.filter((m) => (!m.elite || asTroops.includes(m.unitId)) && survives(m));
	const room = Math.max(0, p.promotion.maxElite - eliteNow);
	if (!troops.length || room === 0) return { ...r, promotion: { pool, rolled: true, streakAfter: streak } };
	const per = assignPromotionDice(pool, troops.length);
	const { results, streak: after } = rollPromotions(per, streak, p.promotion.autoAfter, room, d6);
	const byId = new Map(troops.map((m, i) => [m.unitId, results[i]]));
	return {
		...r,
		models: r.models.map((m) => (byId.has(m.unitId) ? { ...m, promotion: byId.get(m.unitId)!, elite: m.elite || byId.get(m.unitId)!.promoted } : m)),
		promotion: { pool, rolled: true, streakAfter: after }
	};
}

/** Experience each model gains: 1 for an ELITE model that survived, a second for one that did a Glorious Deed. */
export function experienceOf(m: AftermathModel, u: UnitFacts | undefined, d6: () => number, bonus = 0): number {
	if (!m.elite || !survives(m) || u?.noExperience) return 0;
	let xp = 1 + (m.deeds > 0 ? 1 : 0) + bonus;
	const extra = m.trauma?.extraXp;
	if (typeof extra === 'number') xp += extra;
	else if (typeof extra === 'string' && /^d3$/i.test(extra)) xp += Math.ceil(d6() / 2);
	return xp;
}

/** How many Advancement Rolls the model may make after this game's Experience. */
export function advancementsOwed(m: AftermathModel, u: UnitFacts | undefined, p: Progression): number {
	if (!u || !m.elite || !survives(m)) return 0;
	// A Troop promoted this game starts again at 0 Experience.
	const before = m.promotion?.promoted ? 0 : u.experience;
	const made = m.promotion?.promoted ? 0 : u.advancementsMade;
	return advancementsDue(p, before + m.xp, made) - m.advancements.length;
}

/** Make one Advancement Roll: roll on each picked Skill Table; the player then picks one of the skills. */
export function rollAdvancement(
	picked: CampaignTable[],
	dice: Progression['advancement']['dice'],
	known: string[],
	patronSkills: string[],
	d6: () => number
): Advancement {
	return {
		tables: picked.map((t) => t.id),
		rolls: picked.map((t) => {
			const r = roll(dice, d6);
			const s = skillFrom(t, r.total, known, patronSkills);
			return { table: t.id, dice: r.dice, total: r.total, skill: s?.name ?? null, text: s?.text ?? '' };
		}),
		chosen: null
	};
}

/**
 * What the approved report does to each unit: its new Experience, skills, injuries, rank and status. A third
 * Battle Scar (more with War-Luck) leaves it Unfit for Duty: it goes home, its kit to the arsenal. `loseKit`: kit
 * an injury takes (all it can lose, or what matches).
 */
export function applyReport(r: AftermathLines, units: UnitFacts[], tables: CampaignTable[] = []) {
	return r.models.flatMap((m) => {
		const u = units.find((x) => x.id === m.unitId);
		if (!u) return [];
		// A promoted ELITE model (one that took dice as a Troop) heals its Head Wound instead of a new rank.
		const healed = !!m.promotion?.promoted && u.category === 'elite';
		const promoted = !!m.promotion?.promoted && !healed;
		const injury = m.elite && m.trauma && !m.trauma.dead && !m.trauma.retire && m.trauma.result !== '?' ? m.trauma.result : null;
		const skills = [...u.skills, ...m.advancements.map((a) => a.chosen).filter((s): s is string => !!s)];
		const row = m.trauma && injury ? tables.flatMap((t) => t.rows).find((x) => x.name === injury) : null;
		const keepsInjury = !!injury && !!row && (row.effects?.scar || !!row.effects?.stats || !!row.effects?.keywords || !!row.effects?.limits || !!row.effects?.remove_keywords);
		const kept = keepsInjury || (injury && !row && !/full recovery/i.test(injury)) ? [...u.injuries, injury!] : u.injuries;
		const injuries = healed ? kept.map((n) => (tables.flatMap((t) => t.rows).find((x) => x.name === n)?.effects?.no_experience && !/\(healed\)/i.test(n) ? `${n} (healed)` : n)) : kept;
		const fx = effectsOf([...skills, ...injuries], tables);
		const unfit = !!tables.length && fx.scars >= 3 + fx.extraScars;
		const loseKit: true | ItemSel | null = row?.effects?.lose_kit ?? null;
		return [
			{
				unitId: u.id,
				experience: (promoted ? 0 : u.experience) + m.xp,
				injuries,
				skills,
				category: promoted ? ('elite' as const) : u.category,
				status: m.trauma?.dead ? ('dead' as const) : m.trauma?.retire || unfit ? ('retired' as const) : undefined,
				unfit,
				loseKit
			}
		];
	});
}
