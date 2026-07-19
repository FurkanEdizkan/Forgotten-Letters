/**
 * Two-factor authentication (TOTP).
 *
 * Enrolment is two-phase on purpose: generating a secret does NOT enable
 * 2FA. The user must prove they can produce a valid code first, and only
 * then is `totpConfirmedAt` set. Enabling on generation would lock out
 * anyone who scanned the QR incorrectly or abandoned setup halfway.
 *
 * Recovery codes are the only way back in if the device is lost. They
 * are stored as bcrypt hashes and consumed on use, exactly like
 * passwords — a leaked database must not yield usable codes.
 */
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import * as OTPAuth from "otpauth";

const ISSUER = "Forgotten Letters";
const RECOVERY_CODE_COUNT = 10;
/** Lower than password rounds: these are high-entropy and checked in a loop. */
const RECOVERY_ROUNDS = 10;

/**
 * Accept the adjacent 30-second steps as well as the current one.
 * Clock drift between phone and server is common; a window of 1 is the
 * usual trade-off between usability and brute-force surface.
 */
const VALIDATION_WINDOW = 1;

export function generateSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

/** otpauth:// URI for the QR code. */
export function buildOtpAuthUrl(secret: string, accountLabel: string): string {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: accountLabel,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).toString();
}

/** Whether a 6-digit code is currently valid for this secret. */
export function verifyCode(secret: string, code: string): boolean {
  const normalized = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;

  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  // Returns the matched time-step delta, or null.
  return totp.validate({ token: normalized, window: VALIDATION_WINDOW }) !== null;
}

export type RecoveryCodes = {
  /** Shown to the user exactly once. */
  plaintext: string[];
  /** Stored. */
  hashed: string[];
};

/**
 * Generate recovery codes.
 *
 * Formatted in two groups for legibility when written down. 40 bits of
 * entropy each, which is ample given they are single-use and rate
 * limited by the login flow.
 */
export async function generateRecoveryCodes(): Promise<RecoveryCodes> {
  const plaintext = Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const raw = randomBytes(5).toString("hex");
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });

  const hashed = await Promise.all(
    plaintext.map((code) => bcrypt.hash(code, RECOVERY_ROUNDS)),
  );

  return { plaintext, hashed };
}

/**
 * Check a recovery code against the stored hashes.
 *
 * Returns the remaining hashes with the used one removed, or null if it
 * did not match. Codes are single-use: the caller must persist the
 * returned array, or a leaked code stays valid forever.
 */
export async function consumeRecoveryCode(
  code: string,
  hashes: string[],
): Promise<string[] | null> {
  const normalized = code.trim().toLowerCase();

  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(normalized, hashes[i])) {
      return [...hashes.slice(0, i), ...hashes.slice(i + 1)];
    }
  }
  return null;
}
