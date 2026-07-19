/**
 * TOTP and recovery codes.
 *
 * These are auth primitives, so the cases below are mostly about what
 * must be *rejected*.
 */
import { describe, expect, it } from "vitest";
import * as OTPAuth from "otpauth";

import {
  buildOtpAuthUrl,
  consumeRecoveryCode,
  generateRecoveryCodes,
  generateSecret,
  verifyCode,
} from "@/lib/auth/totp";

/** Produce the code an authenticator app would show right now. */
function currentCode(secret: string, offsetSeconds = 0): string {
  const totp = new OTPAuth.TOTP({
    issuer: "Forgotten Letters",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.generate({ timestamp: Date.now() + offsetSeconds * 1000 });
}

describe("generateSecret", () => {
  it("returns a distinct base32 secret each time", () => {
    const a = generateSecret();
    const b = generateSecret();
    expect(a).toMatch(/^[A-Z2-7]+$/);
    expect(a).not.toBe(b);
  });
});

describe("buildOtpAuthUrl", () => {
  it("produces a scannable otpauth URI carrying the issuer", () => {
    const url = buildOtpAuthUrl(generateSecret(), "soldier@front.line");
    expect(url).toMatch(/^otpauth:\/\/totp\//);
    expect(url).toContain("Forgotten%20Letters");
    expect(url).toContain("period=30");
  });
});

describe("verifyCode", () => {
  it("accepts the current code", () => {
    const secret = generateSecret();
    expect(verifyCode(secret, currentCode(secret))).toBe(true);
  });

  it("tolerates one step of clock drift in each direction", () => {
    // Phones drift; rejecting ±30s would generate constant support load.
    const secret = generateSecret();
    expect(verifyCode(secret, currentCode(secret, -30))).toBe(true);
    expect(verifyCode(secret, currentCode(secret, 30))).toBe(true);
  });

  it("rejects a code from well outside the window", () => {
    const secret = generateSecret();
    expect(verifyCode(secret, currentCode(secret, -300))).toBe(false);
  });

  it("rejects a code generated for a different secret", () => {
    expect(verifyCode(generateSecret(), currentCode(generateSecret()))).toBe(false);
  });

  it("rejects malformed input without throwing", () => {
    const secret = generateSecret();
    for (const bad of ["", "12345", "1234567", "abcdef", "12 34 56 78"]) {
      expect(verifyCode(secret, bad), bad).toBe(false);
    }
  });

  it("ignores whitespace in an otherwise valid code", () => {
    // Authenticator apps display "123 456"; users paste it verbatim.
    const secret = generateSecret();
    const code = currentCode(secret);
    expect(verifyCode(secret, `${code.slice(0, 3)} ${code.slice(3)}`)).toBe(true);
  });
});

describe("recovery codes", () => {
  it("generates ten codes and their hashes", async () => {
    const { plaintext, hashed } = await generateRecoveryCodes();
    expect(plaintext).toHaveLength(10);
    expect(hashed).toHaveLength(10);
    expect(new Set(plaintext).size).toBe(10);
  });

  it("never stores a code in plaintext", async () => {
    // A database leak must not yield usable codes.
    const { plaintext, hashed } = await generateRecoveryCodes();
    for (const hash of hashed) {
      expect(plaintext).not.toContain(hash);
      expect(hash.startsWith("$2")).toBe(true);
    }
  });

  it("accepts a valid code and removes it from the set", async () => {
    const { plaintext, hashed } = await generateRecoveryCodes();
    const remaining = await consumeRecoveryCode(plaintext[3], hashed);
    expect(remaining).not.toBeNull();
    expect(remaining).toHaveLength(9);
  });

  it("makes a code single-use", async () => {
    // Reusable codes are as good as a permanent bypass.
    const { plaintext, hashed } = await generateRecoveryCodes();
    const remaining = await consumeRecoveryCode(plaintext[0], hashed);
    expect(await consumeRecoveryCode(plaintext[0], remaining!)).toBeNull();
  });

  it("rejects an unknown code", async () => {
    const { hashed } = await generateRecoveryCodes();
    expect(await consumeRecoveryCode("abcde-fghij", hashed)).toBeNull();
  });

  it("is case- and whitespace-insensitive", async () => {
    const { plaintext, hashed } = await generateRecoveryCodes();
    const messy = `  ${plaintext[1].toUpperCase()}  `;
    expect(await consumeRecoveryCode(messy, hashed)).not.toBeNull();
  });

  it("returns null against an empty set rather than throwing", async () => {
    expect(await consumeRecoveryCode("abcde-fghij", [])).toBeNull();
  });
});
