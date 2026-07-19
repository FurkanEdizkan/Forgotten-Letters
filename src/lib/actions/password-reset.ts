"use server";

/**
 * Password reset.
 *
 * Reuses the Auth.js `verificationToken` table rather than adding a
 * parallel one — same shape (identifier, token, expires), same cleanup.
 * The identifier is namespaced so a reset token can never be mistaken
 * for an email-verification token.
 */
import { and, eq, lt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

import { db } from "@/lib/db/client";
import { users, verificationTokens } from "@/lib/db/schema";
import { sendMail } from "@/lib/mail";
import { clientEnv } from "@/lib/env";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validations/auth";
import type { ActionResult } from "./auth";

const BCRYPT_ROUNDS = 12;
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const RESET_PREFIX = "pwreset:";

/**
 * Tokens are stored hashed. A database leak would otherwise hand an
 * attacker live reset links for every pending request.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestPasswordResetAction(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email address." };
  }
  const { email } = parsed.data;

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Always report success. Revealing whether an address is registered
  // turns this form into an account-enumeration oracle.
  if (user) {
    const token = randomBytes(32).toString("hex");
    const identifier = `${RESET_PREFIX}${email}`;

    // One live token per address: issuing a new link invalidates the old.
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.identifier, identifier));

    await db.insert(verificationTokens).values({
      identifier,
      token: hashToken(token),
      expires: new Date(Date.now() + TOKEN_TTL_MS),
    });

    const url = `${clientEnv.NEXT_PUBLIC_SITE_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    await sendMail({
      to: email,
      subject: "Reset your Forgotten Letters password",
      text:
        `Someone requested a password reset for this account.\n\n` +
        `Reset it here (valid for one hour):\n${url}\n\n` +
        `If this wasn't you, ignore this message — nothing has changed.`,
    }).catch(() => {
      // Swallow: a mail failure must not change the response, or the
      // difference re-introduces the enumeration leak.
    });
  }

  return { ok: true };
}

export async function resetPasswordAction(formData: FormData): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) {
    return { ok: false, error: "This reset link is invalid or has expired." };
  }

  const identifier = `${RESET_PREFIX}${email}`;

  // Clear anything already expired before looking, so a stale row can
  // never satisfy the lookup.
  await db.delete(verificationTokens).where(lt(verificationTokens.expires, new Date()));

  const [row] = await db
    .select()
    .from(verificationTokens)
    .where(eq(verificationTokens.identifier, identifier))
    .limit(1);

  if (!row) {
    return { ok: false, error: "This reset link is invalid or has expired." };
  }

  // Constant-time compare so response timing does not leak how much of
  // a guessed token was correct.
  const supplied = Buffer.from(hashToken(parsed.data.token), "hex");
  const stored = Buffer.from(row.token, "hex");
  const valid = supplied.length === stored.length && timingSafeEqual(supplied, stored);

  if (!valid || row.expires < new Date()) {
    return { ok: false, error: "This reset link is invalid or has expired." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, BCRYPT_ROUNDS);

  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.email, email));
    // Single-use: consume the token in the same transaction as the change.
    await tx
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, identifier),
          eq(verificationTokens.token, row.token),
        ),
      );
  });

  await sendMail({
    to: email,
    subject: "Your Forgotten Letters password was changed",
    text:
      `Your password was just changed.\n\n` +
      `If this wasn't you, reset it immediately at ` +
      `${clientEnv.NEXT_PUBLIC_SITE_URL}/forgot-password`,
  }).catch(() => {
    // The password is already changed; a failed notice must not undo it.
  });

  return { ok: true };
}
