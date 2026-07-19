/**
 * Login 2FA challenge.
 *
 * Deliberately NOT in a "use server" file. This takes a userId, so as a
 * server action any client could call it against an arbitrary account
 * and brute-force codes. It is called only from the Credentials
 * provider, which has already verified the password.
 */
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { consumeRecoveryCode, verifyCode } from "@/lib/auth/totp";

/**
 * Returns true when the challenge passes, or when the account has no
 * confirmed enrolment (nothing to challenge). A used recovery code is
 * consumed so it cannot be replayed.
 */
export async function verifyLoginChallenge(
  userId: string,
  code: string,
): Promise<boolean> {
  const [row] = await db
    .select({
      secret: users.totpSecret,
      confirmedAt: users.totpConfirmedAt,
      recovery: users.totpRecoveryCodes,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row?.secret || !row.confirmedAt) return true;

  if (verifyCode(row.secret, code)) return true;

  const remaining = await consumeRecoveryCode(code, row.recovery ?? []);
  if (remaining) {
    await db
      .update(users)
      .set({ totpRecoveryCodes: remaining })
      .where(eq(users.id, userId));
    return true;
  }

  return false;
}

/** Whether an account has 2FA enabled, for the login flow. */
export async function isTotpEnabled(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ confirmedAt: users.totpConfirmedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return Boolean(row?.confirmedAt);
}
