import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { MarkAllReadButton } from "@/components/social/MarkAllReadButton";
import { requireUser } from "@/lib/auth/guards";
import { listNotifications } from "@/lib/queries/notifications";

export const metadata: Metadata = { title: "Notifications" };

// A per-user feed must never be served from a cache. auth() already
// makes this dynamic in practice, but relying on that implicitly means
// an unrelated refactor could silently make one user's notifications
// cacheable and visible to another.
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await listNotifications(user.id);
  const hasUnread = items.some((n) => !n.isRead);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-6">
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-ink">
          Notifications
        </h1>
        {hasUnread && <MarkAllReadButton />}
      </header>

      {items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">
          Nothing yet. Comments and replies on your scenarios appear here.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {items.map((n) => (
            <Card
              key={n.id}
              className={
                n.isRead
                  ? "flex items-start gap-3 p-4"
                  : "flex items-start gap-3 border-l-2 border-l-primary p-4"
              }
            >
              <Bell
                className={
                  n.isRead ? "mt-0.5 size-4 text-faint" : "mt-0.5 size-4 text-primary"
                }
              />
              <div className="flex-1">
                <Link href={n.url} className="text-sm text-ink hover:text-primary">
                  {n.title}
                </Link>
                <p className="mt-1 font-mono text-[0.625rem] uppercase tracking-wider text-faint">
                  {n.actor ? `@${n.actor.username} · ` : ""}
                  {new Date(n.createdAt).toLocaleDateString()}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
