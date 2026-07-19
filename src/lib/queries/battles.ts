/**
 * Battle reads. Server-only, not server actions.
 */
import { asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { battleParticipants, battles, scenarios } from "@/lib/db/schema";

export type BattleView = {
  id: string;
  playedAt: Date;
  notes: string | null;
  scenario: { slug: string; title: string } | null;
  participants: {
    displayName: string;
    result: "win" | "loss" | "draw";
    score: number | null;
  }[];
};

/** Battles in a campaign, most recent first. */
export async function listBattles(campaignId: string): Promise<BattleView[]> {
  const rows = await db
    .select({
      id: battles.id,
      playedAt: battles.playedAt,
      notes: battles.notes,
      scenarioSlug: scenarios.slug,
      scenarioTitle: scenarios.title,
    })
    .from(battles)
    .leftJoin(scenarios, eq(scenarios.id, battles.scenarioId))
    .where(eq(battles.campaignId, campaignId))
    .orderBy(desc(battles.playedAt))
    .limit(100);

  if (rows.length === 0) return [];

  // One query for all participants rather than one per battle.
  const parts = await db
    .select()
    .from(battleParticipants)
    .where(
      inArray(
        battleParticipants.battleId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(battleParticipants.displayName));

  const byBattle = new Map<string, BattleView["participants"]>();
  for (const p of parts) {
    byBattle.set(p.battleId, [
      ...(byBattle.get(p.battleId) ?? []),
      { displayName: p.displayName, result: p.result, score: p.score },
    ]);
  }

  return rows.map((r) => ({
    id: r.id,
    playedAt: r.playedAt,
    notes: r.notes,
    scenario: r.scenarioSlug
      ? { slug: r.scenarioSlug, title: r.scenarioTitle ?? r.scenarioSlug }
      : null,
    participants: byBattle.get(r.id) ?? [],
  }));
}
