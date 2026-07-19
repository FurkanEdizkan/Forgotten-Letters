/**
 * Social read queries.
 *
 * Deliberately NOT in a "use server" file. That directive turns every
 * export into a client-callable RPC endpoint, and getFavoritedSet takes
 * a userId — as an action, any client could pass someone else's id and
 * read their favorites. These are server-only helpers called from
 * server components, so they must not be exported as actions.
 */
import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { comments, favorites, profiles } from "@/lib/db/schema";
import type { TargetType } from "@/lib/db/votes";

export type CommentView = {
  id: string;
  parentId: string | null;
  body: string;
  isDeleted: boolean;
  createdAt: Date;
  author: { username: string; displayName: string | null } | null;
};

/** Comments for a target, newest first, with author profiles joined. */
export async function listComments(
  targetType: TargetType,
  targetId: string,
): Promise<CommentView[]> {
  const rows = await db
    .select({
      id: comments.id,
      parentId: comments.parentId,
      body: comments.body,
      isDeleted: comments.isDeleted,
      createdAt: comments.createdAt,
      username: profiles.username,
      displayName: profiles.displayName,
    })
    .from(comments)
    .leftJoin(profiles, eq(profiles.userId, comments.authorId))
    .where(and(eq(comments.targetType, targetType), eq(comments.targetId, targetId)))
    .orderBy(desc(comments.createdAt))
    .limit(500);

  return rows.map((r) => ({
    id: r.id,
    parentId: r.parentId,
    // A deleted comment's body never leaves the server, even blanked —
    // the tombstone is what readers should see.
    body: r.isDeleted ? "" : r.body,
    isDeleted: r.isDeleted,
    createdAt: r.createdAt,
    author: r.username ? { username: r.username, displayName: r.displayName } : null,
  }));
}

/** Which of these targets the given user has favorited. */
export async function getFavoritedSet(
  userId: string,
  targetType: TargetType,
  targetIds: string[],
): Promise<Set<string>> {
  if (targetIds.length === 0) return new Set();

  const rows = await db
    .select({ targetId: favorites.targetId })
    .from(favorites)
    .where(
      and(
        eq(favorites.userId, userId),
        eq(favorites.targetType, targetType),
        inArray(favorites.targetId, targetIds),
      ),
    );

  return new Set(rows.map((r) => r.targetId));
}
