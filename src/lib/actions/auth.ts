"use server";

/**
 * Auth server actions.
 *
 * Return shape is a discriminated result rather than thrown errors, so
 * forms can render field-level messages. Anything unexpected still
 * throws and surfaces as a 500.
 */
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";

import { db } from "@/lib/db/client";
import { entitlements, profiles, users } from "@/lib/db/schema";
import { signIn } from "@/lib/auth";
import { sendMail } from "@/lib/mail";
import { clientEnv } from "@/lib/env";
import { loginSchema, registerSchema } from "@/lib/validations/auth";

/** Work factor for bcrypt. 12 is ~250ms on modern hardware. */
const BCRYPT_ROUNDS = 12;

export type ActionResult =
  { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function registerAction(formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    username: String(formData.get("username") ?? "")
      .trim()
      .toLowerCase(),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { username, email, password } = parsed.data;

  const [existingEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const [existingUsername] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(eq(profiles.username, username))
    .limit(1);

  if (existingUsername) {
    return {
      ok: false,
      error: "Please correct the errors below.",
      fieldErrors: { username: ["That username is taken"] },
    };
  }

  // Do NOT reveal that the email is registered — that turns registration
  // into an account-enumeration oracle. Claim success and send a "someone
  // tried to register with your address" email instead.
  if (existingEmail) {
    await sendMail({
      to: email,
      subject: "Someone tried to register with your email",
      text:
        `An account already exists for ${email}.\n\n` +
        `If this was you, sign in at ${clientEnv.NEXT_PUBLIC_SITE_URL}/login ` +
        `or reset your password. If it wasn't, you can ignore this message.`,
    }).catch(() => {
      // Mail failure must not change the response, or the timing/outcome
      // difference re-introduces the enumeration leak.
    });
    return { ok: true };
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ email, passwordHash }).returning();
    await tx
      .insert(profiles)
      .values({ userId: user.id, username, displayName: username });
    // Conscript (free tier) defaults come from the column defaults.
    // Created here so no code path has to cope with a missing row.
    await tx.insert(entitlements).values({ userId: user.id });
  });

  await sendMail({
    to: email,
    subject: "Welcome to Forgotten Letters",
    text:
      `Your account is ready, ${username}.\n\n` +
      `Sign in at ${clientEnv.NEXT_PUBLIC_SITE_URL}/login`,
  }).catch(() => {
    // A failed welcome email must not fail registration — the account
    // exists and the user can already sign in.
  });

  return { ok: true };
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Enter your email and password." };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // One message for every failure mode: wrong password, unknown
      // email, and OAuth-only account must be indistinguishable.
      return { ok: false, error: "Invalid email or password." };
    }
    throw error;
  }

  return { ok: true };
}
