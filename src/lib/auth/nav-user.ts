/**
 * The minimal user shape the navbar needs.
 *
 * Kept separate from guards.ts so the root layout does not pull the
 * redirect-based helpers into every page render.
 */
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import type { NavUser } from "@/components/layout/UserMenu";

export async function getNavUser(): Promise<NavUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [profile] = await db
    .select({ username: profiles.username, displayName: profiles.displayName })
    .from(profiles)
    .where(eq(profiles.userId, session.user.id))
    .limit(1);

  // A session without a profile means the row was deleted mid-session;
  // treat it as signed out rather than rendering a broken menu.
  return profile ?? null;
}
