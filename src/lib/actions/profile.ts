"use server";

/**
 * Profile settings.
 *
 * Everything here mutates the caller's own row only — the WHERE clause
 * is always scoped by the session user id, never by a client-supplied
 * id, so there is no path to editing someone else's profile.
 */
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { signOut } from "@/lib/auth";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { profiles, users } from "@/lib/db/schema";
import { stripHtml } from "@/lib/sanitize";
import { usernameSchema } from "@/lib/validations/auth";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const profileSchema = z.object({
  username: usernameSchema,
  displayName: z
    .string()
    .trim()
    .max(60, "Display name must be at most 60 characters")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  bio: z
    .string()
    .trim()
    .max(500, "Bio must be at most 500 characters")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export async function updateProfileAction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    username: String(formData.get("username") ?? "")
      .trim()
      .toLowerCase(),
    displayName: formData.get("displayName"),
    bio: formData.get("bio"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { username, displayName, bio } = parsed.data;

  // Usernames are public identifiers and appear in URLs, so a collision
  // is reported plainly — unlike email, this leaks nothing private.
  const [taken] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(and(eq(profiles.username, username), ne(profiles.userId, user.id)))
    .limit(1);

  if (taken) {
    return {
      ok: false,
      error: "Please correct the errors below.",
      fieldErrors: { username: ["That username is taken"] },
    };
  }

  const [previous] = await db
    .select({ username: profiles.username })
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);

  await db
    .update(profiles)
    .set({
      username,
      displayName: displayName ?? null,
      // Bios render as plain text; strip markup rather than sanitizing,
      // since there is no reason for a bio to carry HTML at all.
      bio: bio ? stripHtml(bio) : null,
    })
    .where(eq(profiles.userId, user.id));

  // A username change moves every /user/<name> and /scenarios/<name>/…
  // URL this user owns, so revalidate both the old and new paths.
  if (previous && previous.username !== username) {
    revalidatePath(`/user/${previous.username}`);
  }
  revalidatePath(`/user/${username}`);
  revalidatePath("/scenarios");

  return { ok: true, data: undefined };
}

/**
 * Delete the account and everything it owns.
 *
 * Cascades from users: profile, scenarios, campaigns, comments, votes,
 * favorites, uploads, entitlements. Uploaded objects still sit in
 * storage afterwards — removing those needs a sweep over uploaded_files
 * before this row goes, which is Phase 8 work that is not done yet.
 * Recorded here rather than silently pretended.
 */
export async function deleteAccountAction(confirmation: string): Promise<ActionResult> {
  const user = await requireUser();

  // Typed confirmation: this is irreversible and cascades widely.
  if (confirmation !== user.email) {
    return { ok: false, error: "Type your email address exactly to confirm." };
  }

  await db.delete(users).where(eq(users.id, user.id));

  // The session must die with the account. Sessions are JWTs, not
  // database rows, so deleting the user does NOT invalidate the cookie:
  // middleware would keep seeing a valid token, keep treating the
  // request as signed in, and redirect the now-deleted user away from
  // /login — locking them out of even registering again.
  await signOut({ redirect: false });

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
