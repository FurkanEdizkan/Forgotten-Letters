/**
 * Vote counting.
 *
 * Replaces the Supabase `get_vote_count` function. Counts are computed
 * on read rather than cached on the target row: vote volume here is low,
 * and a cached counter is one more thing to drift.
 */
import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "./client";
import { votes } from "./schema";
import type { targetTypeEnum } from "./schema";

export type TargetType = (typeof targetTypeEnum.enumValues)[number];

/** Net score (upvotes minus downvotes) for one target. */
export async function getVoteCount(
  targetType: TargetType,
  targetId: string,
): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`COALESCE(SUM(${votes.value}), 0)::int` })
    .from(votes)
    .where(and(eq(votes.targetType, targetType), eq(votes.targetId, targetId)));
  return Number(row?.total ?? 0);
}

/** Net scores for many targets at once, avoiding N+1 on list pages. */
export async function getVoteCounts(
  targetType: TargetType,
  targetIds: string[],
): Promise<Map<string, number>> {
  if (targetIds.length === 0) return new Map();

  const rows = await db
    .select({
      targetId: votes.targetId,
      total: sql<number>`COALESCE(SUM(${votes.value}), 0)::int`,
    })
    .from(votes)
    // inArray is parameterized. Building an ARRAY[...] literal by
    // interpolating the ids would be an injection hole, however the
    // values are escaped.
    .where(and(eq(votes.targetType, targetType), inArray(votes.targetId, targetIds)))
    .groupBy(votes.targetId);

  const counts = new Map<string, number>();
  for (const id of targetIds) counts.set(id, 0);
  for (const row of rows) counts.set(row.targetId, Number(row.total));
  return counts;
}

/**
 * Cast or change a vote.
 *
 * Idempotent by (user, target): voting the same way twice leaves one
 * row, and switching direction updates it rather than accumulating.
 * Returns the new net count.
 */
export async function castVote(input: {
  userId: string;
  targetType: TargetType;
  targetId: string;
  value: 1 | -1;
}): Promise<number> {
  await db
    .insert(votes)
    .values({
      userId: input.userId,
      targetType: input.targetType,
      targetId: input.targetId,
      value: input.value,
    })
    .onConflictDoUpdate({
      target: [votes.userId, votes.targetType, votes.targetId],
      set: { value: input.value },
    });

  return getVoteCount(input.targetType, input.targetId);
}

/** Remove a vote. Returns the new net count. */
export async function clearVote(input: {
  userId: string;
  targetType: TargetType;
  targetId: string;
}): Promise<number> {
  await db
    .delete(votes)
    .where(
      and(
        eq(votes.userId, input.userId),
        eq(votes.targetType, input.targetType),
        eq(votes.targetId, input.targetId),
      ),
    );
  return getVoteCount(input.targetType, input.targetId);
}
