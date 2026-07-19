"use server";

/**
 * Battle recording.
 *
 * Only the campaign owner can record or delete battles in their
 * campaign. Ownership is re-read from the database on every mutation;
 * the client's claim about which campaign it is writing to is checked,
 * not trusted.
 */
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { battleParticipants, battles, campaigns, scenarios } from "@/lib/db/schema";
import { stripHtml } from "@/lib/sanitize";

export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: string };

const participantSchema = z.object({
  displayName: z.string().trim().min(1, "Name a participant").max(60),
  result: z.enum(["win", "loss", "draw"]),
  score: z.number().int().min(0).max(999).optional().nullable(),
});

const battleSchema = z.object({
  campaignId: z.string().min(1),
  scenarioId: z.string().min(1).optional().nullable(),
  playedAt: z.string().optional(),
  notes: z.string().trim().max(2_000).optional(),
  // Two sides minimum; a "battle" with one participant records nothing.
  participants: z.array(participantSchema).min(2, "Record at least two sides").max(8),
});

export async function recordBattleAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();

  const parsed = battleSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid battle." };
  }
  const input = parsed.data;

  // The campaign must belong to the caller.
  const [campaign] = await db
    .select({ id: campaigns.id, slug: campaigns.slug })
    .from(campaigns)
    .where(and(eq(campaigns.id, input.campaignId), eq(campaigns.authorId, user.id)))
    .limit(1);

  if (!campaign) return { ok: false, error: "Not found." };

  // A named scenario must belong to the same campaign, or a battle
  // could reference someone else's unrelated scenario.
  if (input.scenarioId) {
    const [scenario] = await db
      .select({ id: scenarios.id })
      .from(scenarios)
      .where(
        and(eq(scenarios.id, input.scenarioId), eq(scenarios.campaignId, campaign.id)),
      )
      .limit(1);
    if (!scenario)
      return { ok: false, error: "That scenario is not in this campaign." };
  }

  // An invalid date string would become Invalid Date and store as null
  // silently; fall back to now instead.
  const playedAt = input.playedAt ? new Date(input.playedAt) : new Date();
  const when = Number.isNaN(playedAt.getTime()) ? new Date() : playedAt;

  const created = await db.transaction(async (tx) => {
    const [battle] = await tx
      .insert(battles)
      .values({
        campaignId: campaign.id,
        scenarioId: input.scenarioId ?? null,
        recordedById: user.id,
        playedAt: when,
        notes: input.notes ? stripHtml(input.notes) : null,
      })
      .returning();

    await tx.insert(battleParticipants).values(
      input.participants.map((p) => ({
        battleId: battle.id,
        displayName: p.displayName,
        result: p.result,
        score: p.score ?? null,
      })),
    );

    return battle;
  });

  revalidatePath("/campaigns");
  return { ok: true, data: { id: created.id } };
}

export async function deleteBattleAction(battleId: string): Promise<ActionResult> {
  const user = await requireUser();

  // Scoped by the recorder, so another user's id matches nothing.
  const [deleted] = await db
    .delete(battles)
    .where(and(eq(battles.id, battleId), eq(battles.recordedById, user.id)))
    .returning();

  if (!deleted) return { ok: false, error: "Not found." };

  revalidatePath("/campaigns");
  return { ok: true, data: undefined };
}
