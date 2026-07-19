/**
 * Authorization guards.
 *
 * These replace Supabase RLS (docs/Architecture.md, old→new mapping).
 * Every mutating server action must call one — the database no longer
 * enforces per-row access, so the app layer is the only thing standing
 * between a user and someone else's data.
 */
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
};

/** Current user, or null when signed out. Never throws. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
  };
}

/**
 * Require a signed-in user. Redirects to login when absent.
 * Use in pages and actions that must not run anonymously.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Require an admin. Redirects rather than 403s so the existence of admin
 * routes is not confirmed to non-admins.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  const [profile] = await db
    .select({ isAdmin: profiles.isAdmin })
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);
  if (!profile?.isAdmin) redirect("/");
  return user;
}

/**
 * Assert the signed-in user owns a resource.
 *
 * Takes the owner id rather than fetching, so callers load the row once
 * and pass its ownerId in — avoiding a second query per check.
 */
export function assertOwner(user: SessionUser, ownerId: string): void {
  if (user.id !== ownerId) {
    // Deliberately vague: distinguishing "not yours" from "does not
    // exist" tells an attacker which ids are real.
    throw new Error("Not found");
  }
}
