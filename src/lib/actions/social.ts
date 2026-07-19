"use server";

/**
 * Social actions — votes, favorites, comments.
 *
 * Every action is authenticated and validates its target type against
 * the enum, because targetId is polymorphic: there is no foreign key
 * constraining it, so an unchecked targetType would let a caller attach
 * a vote to a table that does not exist.
 */
import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { comments, favorites, profiles, scenarios } from "@/lib/db/schema";
import { notify } from "@/lib/notify";
import { castVote, clearVote, type TargetType } from "@/lib/db/votes";
import { sanitizeComment, stripHtml } from "@/lib/sanitize";

export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: string };

const targetSchema = z.object({
  targetType: z.enum(["scenario", "campaign", "warband", "comment"]),
  targetId: z.string().min(1).max(64),
});

const commentSchema = z.object({
  targetType: z.enum(["scenario", "campaign", "warband", "comment"]),
  targetId: z.string().min(1).max(64),
  parentId: z.string().min(1).max(64).optional().nullable(),
  // Long enough for a considered reply, short enough that one comment
  // cannot be a denial-of-service payload.
  body: z.string().trim().min(1, "Say something").max(5_000, "Comment is too long"),
});

/**
 * Verify the target exists before attaching anything to it.
 *
 * Without this, votes and comments accumulate against ids that were
 * never real — invisible junk that inflates counts.
 */
async function targetExists(
  targetType: TargetType,
  targetId: string,
): Promise<boolean> {
  switch (targetType) {
    case "scenario": {
      const [row] = await db
        .select({ id: scenarios.id })
        .from(scenarios)
        .where(eq(scenarios.id, targetId))
        .limit(1);
      return Boolean(row);
    }
    case "comment": {
      const [row] = await db
        .select({ id: comments.id })
        .from(comments)
        .where(eq(comments.id, targetId))
        .limit(1);
      return Boolean(row);
    }
    // Campaigns and warbands are validated once their tables have read
    // paths; until then treat them as absent rather than assuming valid.
    default:
      return false;
  }
}

/**
 * Notify the people a new comment concerns.
 *
 * The scenario author always hears about it; a reply also pings the
 * parent comment's author. Both go through notify(), which skips
 * self-notification, so one person can receive at most one of these.
 */
async function notifyForComment(input: {
  actorId: string;
  targetType: TargetType;
  targetId: string;
  parentId: string | null;
}): Promise<void> {
  if (input.targetType !== "scenario") return;

  const [scenario] = await db
    .select({
      authorId: scenarios.authorId,
      slug: scenarios.slug,
      title: scenarios.title,
    })
    .from(scenarios)
    .where(eq(scenarios.id, input.targetId))
    .limit(1);

  if (!scenario) return;

  const [authorProfile] = await db
    .select({ username: profiles.username })
    .from(profiles)
    .where(eq(profiles.userId, scenario.authorId))
    .limit(1);

  if (!authorProfile) return;
  const url = `/scenarios/${authorProfile.username}/${scenario.slug}`;

  await notify({
    userId: scenario.authorId,
    actorId: input.actorId,
    type: "comment_on_scenario",
    title: `New comment on “${scenario.title}”`,
    url,
  });

  if (input.parentId) {
    const [parent] = await db
      .select({ authorId: comments.authorId })
      .from(comments)
      .where(eq(comments.id, input.parentId))
      .limit(1);

    // Skip if the parent author is the scenario author — they already
    // got the comment notification above.
    if (parent && parent.authorId !== scenario.authorId) {
      await notify({
        userId: parent.authorId,
        actorId: input.actorId,
        type: "reply_to_comment",
        title: `Someone replied to you on “${scenario.title}”`,
        url,
      });
    }
  }
}

export async function voteAction(input: {
  targetType: TargetType;
  targetId: string;
  value: 1 | -1 | 0;
}): Promise<ActionResult<{ count: number }>> {
  const user = await requireUser();

  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid target." };
  if (!(await targetExists(parsed.data.targetType, parsed.data.targetId))) {
    return { ok: false, error: "Not found." };
  }

  // 0 means "remove my vote" — a separate action would be one more
  // round trip for the same intent.
  const count =
    input.value === 0
      ? await clearVote({ userId: user.id, ...parsed.data })
      : await castVote({ userId: user.id, ...parsed.data, value: input.value });

  return { ok: true, data: { count } };
}

export async function toggleFavoriteAction(input: {
  targetType: TargetType;
  targetId: string;
}): Promise<ActionResult<{ favorited: boolean }>> {
  const user = await requireUser();

  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid target." };
  if (!(await targetExists(parsed.data.targetType, parsed.data.targetId))) {
    return { ok: false, error: "Not found." };
  }

  const [existing] = await db
    .select({ id: favorites.id })
    .from(favorites)
    .where(
      and(
        eq(favorites.userId, user.id),
        eq(favorites.targetType, parsed.data.targetType),
        eq(favorites.targetId, parsed.data.targetId),
      ),
    )
    .limit(1);

  if (existing) {
    await db.delete(favorites).where(eq(favorites.id, existing.id));
    return { ok: true, data: { favorited: false } };
  }

  await db
    .insert(favorites)
    .values({ userId: user.id, ...parsed.data })
    // Two rapid clicks would otherwise violate the unique constraint.
    .onConflictDoNothing();

  return { ok: true, data: { favorited: true } };
}

export async function createCommentAction(input: {
  targetType: TargetType;
  targetId: string;
  parentId?: string | null;
  body: string;
}): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();

  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid comment." };
  }
  if (!(await targetExists(parsed.data.targetType, parsed.data.targetId))) {
    return { ok: false, error: "Not found." };
  }

  // A reply must attach to a real comment on the same target, or threads
  // could be grafted across unrelated scenarios.
  let parentId = parsed.data.parentId ?? null;
  if (parentId) {
    const [parent] = await db
      .select({
        id: comments.id,
        targetId: comments.targetId,
        parentId: comments.parentId,
      })
      .from(comments)
      .where(eq(comments.id, parentId))
      .limit(1);

    if (!parent || parent.targetId !== parsed.data.targetId) {
      return { ok: false, error: "Not found." };
    }

    // Nesting is capped at one level. The UI only offers Reply on
    // top-level comments, but a crafted request could otherwise build
    // arbitrarily deep threads that no layout renders sensibly — so
    // a reply to a reply re-parents onto its top-level ancestor.
    if (parent.parentId) parentId = parent.parentId;
  }

  // Sanitize on write — this is rendered as HTML to every reader.
  const body = sanitizeComment(parsed.data.body);
  if (!stripHtml(body)) {
    // Markup that sanitizes down to nothing is not a comment.
    return { ok: false, error: "Say something." };
  }

  const [created] = await db
    .insert(comments)
    .values({
      authorId: user.id,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      parentId,
      body,
    })
    .returning();

  // Notify after the comment has committed. notify() never throws, so a
  // failure here cannot roll back the comment.
  await notifyForComment({
    actorId: user.id,
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId,
    parentId,
  });

  return { ok: true, data: { id: created.id } };
}

/**
 * Soft-delete a comment.
 *
 * Tombstoned rather than removed so replies beneath it keep their
 * thread position instead of being orphaned or cascade-deleted.
 */
export async function deleteCommentAction(commentId: string): Promise<ActionResult> {
  const user = await requireUser();

  const [updated] = await db
    .update(comments)
    .set({ isDeleted: true, body: "", updatedAt: new Date() })
    .where(and(eq(comments.id, commentId), eq(comments.authorId, user.id)))
    .returning();

  if (!updated) return { ok: false, error: "Not found." };

  revalidatePath("/scenarios");
  return { ok: true, data: undefined };
}
