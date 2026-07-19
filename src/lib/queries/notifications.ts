/**
 * Notification reads. Server-only, not server actions.
 */
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { notifications, profiles } from "@/lib/db/schema";

export type NotificationView = {
  id: string;
  type: string;
  title: string;
  url: string;
  isRead: boolean;
  createdAt: Date;
  actor: { username: string } | null;
};

/** Unread count for the navbar badge. */
export async function getUnreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return Number(row?.n ?? 0);
}

/** Recent notifications for a user, newest first. */
export async function listNotifications(userId: string): Promise<NotificationView[]> {
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      url: notifications.url,
      isRead: notifications.isRead,
      createdAt: notifications.createdAt,
      actorUsername: profiles.username,
    })
    .from(notifications)
    .leftJoin(profiles, eq(profiles.userId, notifications.actorId))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    url: r.url,
    isRead: r.isRead,
    createdAt: r.createdAt,
    actor: r.actorUsername ? { username: r.actorUsername } : null,
  }));
}
