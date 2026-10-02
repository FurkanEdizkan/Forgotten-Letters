/**
 * Aftermath reports: after a committed battle, each side's player records the Campaign Phase for their warband
 * (the server rolls every die, once), and the Campaign Master approves it onto the roster or sends it back.
 */
import { randomInt } from 'node:crypto';
import { and, desc, eq, or } from 'drizzle-orm';
import { db } from './db';
import { aftermathReport, game, warband, warbandStash } from './db/schema';
import { roster, saveUnit, setBank } from './roster';
import { campaignTables } from './rules-data';
import { applyReport, experienceOf, newReport, type AftermathLines, type UnitFacts } from '$lib/aftermath';
import { effectsOf } from '$lib/progression';
import { matchItem } from '$lib/warband-limits';
import { builderInput } from './builder';

export const d6 = () => randomInt(1, 7);

/** The warband's models as the report reads them. */
export async function unitFacts(warbandId: string): Promise<UnitFacts[]> {
	const [{ units }, { tables }] = await Promise.all([roster(warbandId), campaignTables()]);
	return units
		.filter((u) => u.status === 'active')
		.map((u) => ({
			id: u.id,
			name: u.name,
			type: u.type,
			category: u.category,
			keywords: [],
			experience: u.experience,
			skills: u.skills,
			injuries: u.injuries,
			// ponytail: each skill is taken as one Advancement made; a skill granted another way counts too.
			advancementsMade: u.skills.length,
			noExperience: effectsOf(u.injuries, tables).noExperience,
			effects: effectsOf([...u.skills, ...u.injuries], tables)
		}));
}

/** The committed battles this warband fought, newest first, with its report on each (if any). */
export async function reportsOf(warbandId: string) {
	const games = await db
		.select()
		.from(game)
		.where(and(eq(game.status, 'done'), or(eq(game.aggressorId, warbandId), eq(game.defenderId, warbandId))))
		.orderBy(desc(game.committedAt));
	const reports = await db.select().from(aftermathReport).where(eq(aftermathReport.warbandId, warbandId));
	return games.map((g) => ({ game: g, report: reports.find((r) => r.gameId === g.id) ?? null }));
}

/** The report for this battle, made when first opened: every active model, the Glorious Deeds the result recorded. */
export async function reportFor(gameId: string, warbandId: string) {
	const [r] = await db.select().from(aftermathReport).where(and(eq(aftermathReport.gameId, gameId), eq(aftermathReport.warbandId, warbandId)));
	if (r) return r;
	const [g] = await db.select().from(game).where(eq(game.id, gameId));
	if (!g || g.status !== 'done' || ![g.aggressorId, g.defenderId].includes(warbandId)) return null;
	const lines = newReport(await unitFacts(warbandId));
	const [made] = await db.insert(aftermathReport).values({ gameId, warbandId, lines }).returning();
	return made;
}

export async function saveLines(id: string, lines: AftermathLines, status?: 'draft' | 'submitted' | 'approved' | 'declined', reply?: string | null) {
	await db
		.update(aftermathReport)
		.set({ lines, updatedAt: new Date(), ...(status ? { status } : {}), ...(reply !== undefined ? { reply } : {}) })
		.where(eq(aftermathReport.id, id));
}

/** Experience for every model, from what is rolled and marked so far (War Stories: +1 to each other ELITE model). */
export function withExperience(lines: AftermathLines, units: (UnitFacts & { effects?: ReturnType<typeof effectsOf> })[]): AftermathLines {
	const storyteller = units.find((u) => (u.effects?.xpToOthers ?? 0) > 0);
	return {
		...lines,
		models: lines.models.map((m) => ({ ...m, xp: experienceOf(m, units.find((u) => u.id === m.unitId), d6, storyteller && storyteller.id !== m.unitId ? storyteller.effects!.xpToOthers : 0) }))
	};
}

/** The Promotion step's inputs from the warband's skills: ELITE models that count (not Bad Company), and extra dice (Show Off). */
export function promotionInputs(units: (UnitFacts & { effects?: ReturnType<typeof effectsOf> })[]) {
	return {
		eliteNow: units.filter((u) => u.category === 'elite' && !u.effects?.notCountedElite).length,
		extraDice: units.reduce((n, u) => n + (u.effects?.promotionDice ?? 0), 0),
		asTroops: units.filter((u) => u.category === 'elite' && u.noExperience).map((u) => u.id)
	};
}

/** Approve: the roster takes the report (Experience, skills, injuries, rank, deaths), the bank its income. */
export async function approve(reportId: string) {
	const [r] = await db.select().from(aftermathReport).where(eq(aftermathReport.id, reportId));
	if (!r || r.status !== 'submitted') return null;
	const units = await unitFacts(r.warbandId);
	const [w] = await db.select().from(warband).where(eq(warband.id, r.warbandId));
	const { tables } = await campaignTables();
	const input = await builderInput(w);
	const { units: roster_ } = await roster(r.warbandId);
	for (const c of applyReport(r.lines, units, tables)) {
		const { unitId, status, unfit, loseKit, ...fields } = c;
		const u = roster_.find((x) => x.id === unitId);
		let equipment = u?.equipment ?? [];
		const fixed = new Set((input.profiles.find((p) => p.id === u?.profileId)?.kit?.fixed ?? []).map((n) => n.toLowerCase()));
		// An injury takes kit (Robbed: all it can lose; Muscle Damage: its HEAVY kit); kit fixed to the entry stays.
		if (loseKit) equipment = equipment.filter((e) => fixed.has(e.name.toLowerCase()) || (loseKit !== true && !matchItem(e, loseKit, input.armoury)));
		// Unfit for Duty: sent home, its kit to the arsenal.
		if (unfit) {
			for (const e of equipment.filter((x) => !fixed.has(x.name.toLowerCase()))) await db.insert(warbandStash).values({ warbandId: w.id, name: e.name, kind: e.kind, cost: e.cost, currency: e.currency });
			equipment = equipment.filter((x) => fixed.has(x.name.toLowerCase()));
		}
		await saveUnit(r.warbandId, unitId, { ...fields, equipment, ...(status ? { status } : {}) });
	}
	if (r.lines.income.ducats || r.lines.income.glory) await setBank(w.id, w.treasuryDucats + r.lines.income.ducats, w.treasuryGlory + r.lines.income.glory);
	if (r.lines.promotion.streakAfter != null) await db.update(warband).set({ promotionStreak: r.lines.promotion.streakAfter }).where(eq(warband.id, w.id));
	await saveLines(r.id, r.lines, 'approved', null);
	return r;
}
