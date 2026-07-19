/**
 * Notification writing.
 *
 * Called from server actions after the thing being notified about has
 * already committed. Deliberately never throws: a notification is a
 * side effect, and failing to record one must not roll back the comment
 * or vote that caused it.
 */
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema";
import type { notificationTypeEnum } from "@/lib/db/schema";

type NotificationType = (typeof notificationTypeEnum.enumValues)[number];

export async function notify(input: {
  userId: string;
  actorId: string | null;
  type: NotificationType;
  title: string;
  url: string;
}): Promise<void> {
  // Never notify someone about their own action — commenting on your
  // own scenario should not ping you.
  if (input.actorId && input.actorId === input.userId) return;

  try {
    await db.insert(notifications).values(input);
  } catch (error) {
    // Swallowed so a notification failure cannot roll back the comment
    // or vote that caused it — but logged, because a silent swallow
    // makes "notifications stopped working" undiagnosable.
    console.error("[notify] failed to record notification", {
      type: input.type,
      userId: input.userId,
      error,
    });
  }
}

/** Mark every notification read for a user. */
export async function markAllRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.userId, userId));
}
