/**
 * Aftermath reports: after a committed battle, each side's player records the Campaign Phase for their warband
 * (the server rolls every die, once), and the Campaign Master approves it onto the roster or sends it back.
 */
import { randomInt } from 'node:crypto';
import { and, desc, eq, or } from 'drizzle-orm';
import { db } from './db';
import { aftermathReport, game, warband } from './db/schema';
import { roster, saveUnit, setBank } from './roster';
import { campaignTables } from './rules-data';
import { applyReport, experienceOf, newReport, type AftermathLines, type UnitFacts } from '$lib/aftermath';
import { effectsOf } from '$lib/progression';

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
			noExperience: effectsOf(u.injuries, tables).noExperience
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

/** Experience for every model, from what is rolled and marked so far. */
export function withExperience(lines: AftermathLines, units: UnitFacts[]): AftermathLines {
	return { ...lines, models: lines.models.map((m) => ({ ...m, xp: experienceOf(m, units.find((u) => u.id === m.unitId), d6) })) };
}

/** Approve: the roster takes the report (Experience, skills, injuries, rank, deaths), the bank its income. */
export async function approve(reportId: string) {
	const [r] = await db.select().from(aftermathReport).where(eq(aftermathReport.id, reportId));
	if (!r || r.status !== 'submitted') return null;
	const units = await unitFacts(r.warbandId);
	for (const c of applyReport(r.lines, units)) {
		const { unitId, status, ...fields } = c;
		await saveUnit(r.warbandId, unitId, { ...fields, ...(status ? { status } : {}) });
	}
	const [w] = await db.select().from(warband).where(eq(warband.id, r.warbandId));
	if (r.lines.income.ducats || r.lines.income.glory) await setBank(w.id, w.treasuryDucats + r.lines.income.ducats, w.treasuryGlory + r.lines.income.glory);
	if (r.lines.promotion.streakAfter != null) await db.update(warband).set({ promotionStreak: r.lines.promotion.streakAfter }).where(eq(warband.id, w.id));
	await saveLines(r.id, r.lines, 'approved', null);
	return r;
}
