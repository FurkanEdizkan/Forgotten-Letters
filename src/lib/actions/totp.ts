"use server";

/**
 * Two-factor enrolment and removal.
 *
 * Enrolment is two-phase: startTotpEnrollment stores a secret but does
 * NOT enable 2FA. Only confirmTotpEnrollment — which requires a working
 * code — sets totpConfirmedAt. A user who mis-scans the QR or abandons
 * setup is therefore never locked out.
 */
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";

import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import {
  buildOtpAuthUrl,
  consumeRecoveryCode,
  generateRecoveryCodes,
  generateSecret,
  verifyCode,
} from "@/lib/auth/totp";

export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: string };

export type EnrollmentStart = {
  /** Shown under the QR so it can be typed into an app manually. */
  secret: string;
  qrDataUrl: string;
};

export async function startTotpEnrollmentAction(): Promise<
  ActionResult<EnrollmentStart>
> {
  const user = await requireUser();

  const [existing] = await db
    .select({ confirmedAt: users.totpConfirmedAt })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  // Re-enrolling would silently invalidate the working authenticator.
  // Disabling first is an explicit, code-protected step.
  if (existing?.confirmedAt) {
    return { ok: false, error: "Two-factor authentication is already enabled." };
  }

  const secret = generateSecret();

  // Stored unconfirmed. 2FA is not in force until it is verified.
  await db
    .update(users)
    .set({ totpSecret: secret, totpConfirmedAt: null })
    .where(eq(users.id, user.id));

  const qrDataUrl = await QRCode.toDataURL(buildOtpAuthUrl(secret, user.email), {
    margin: 1,
    width: 200,
  });

  return { ok: true, data: { secret, qrDataUrl } };
}

export async function confirmTotpEnrollmentAction(
  code: string,
): Promise<ActionResult<{ recoveryCodes: string[] }>> {
  const user = await requireUser();

  const [row] = await db
    .select({ secret: users.totpSecret, confirmedAt: users.totpConfirmedAt })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!row?.secret) {
    return { ok: false, error: "Start setup again — no pending enrolment found." };
  }
  if (row.confirmedAt) {
    return { ok: false, error: "Two-factor authentication is already enabled." };
  }
  if (!verifyCode(row.secret, code)) {
    return {
      ok: false,
      error: "That code is not valid. Check your authenticator app.",
    };
  }

  const { plaintext, hashed } = await generateRecoveryCodes();

  await db
    .update(users)
    .set({ totpConfirmedAt: new Date(), totpRecoveryCodes: hashed })
    .where(eq(users.id, user.id));

  revalidatePath("/settings/account");
  // Returned once and never again — only the hashes are stored.
  return { ok: true, data: { recoveryCodes: plaintext } };
}

/**
 * Turn 2FA off.
 *
 * Requires a current code or an unused recovery code. Allowing a
 * password-only disable would make 2FA worthless against someone who
 * already has the password — which is the exact threat it exists for.
 */
export async function disableTotpAction(code: string): Promise<ActionResult> {
  const user = await requireUser();

  const [row] = await db
    .select({
      secret: users.totpSecret,
      confirmedAt: users.totpConfirmedAt,
      recovery: users.totpRecoveryCodes,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!row?.secret || !row.confirmedAt) {
    return { ok: false, error: "Two-factor authentication is not enabled." };
  }

  const byCode = verifyCode(row.secret, code);
  const byRecovery = byCode
    ? null
    : await consumeRecoveryCode(code, row.recovery ?? []);

  if (!byCode && !byRecovery) {
    return { ok: false, error: "That code is not valid." };
  }

  await db
    .update(users)
    .set({ totpSecret: null, totpConfirmedAt: null, totpRecoveryCodes: null })
    .where(eq(users.id, user.id));

  revalidatePath("/settings/account");
  return { ok: true, data: undefined };
}

/** Whether 2FA is active, for rendering the settings panel. */
export async function getTotpStatusAction(): Promise<{ enabled: boolean }> {
  const user = await requireUser();
  const [row] = await db
    .select({ confirmedAt: users.totpConfirmedAt })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  return { enabled: Boolean(row?.confirmedAt) };
}
