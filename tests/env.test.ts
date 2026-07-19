/**
 * Tests for the env boundary and the asset-URL helper.
 *
 * src/lib/env.ts validates at module load, so each case sets process.env
 * and then re-imports through vi.resetModules() to get a fresh evaluation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

/** A complete, valid server env — individual tests break one field. */
function validEnv(): Record<string, string> {
  return {
    NODE_ENV: "development",
    DATABASE_URL: "postgresql://forgotten:forgotten@localhost:5432/forgotten_letters",
    R2_ENDPOINT: "http://localhost:9000",
    R2_ACCESS_KEY_ID: "minioadmin",
    R2_SECRET_ACCESS_KEY: "minioadmin",
    R2_REGION: "auto",
    R2_FORCE_PATH_STYLE: "true",
    R2_BUCKET_ASSETS: "forgotten-letters-assets",
    R2_BUCKET_AVATARS: "forgotten-letters-avatars",
    STORAGE_QUOTA_FREE_BYTES: "52428800",
    SES_SMTP_HOST: "localhost",
    SES_SMTP_PORT: "1025",
    SES_SMTP_SECURE: "false",
    EMAIL_FROM: "Forgotten Letters <no-reply@example.com>",
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    NEXT_PUBLIC_ASSET_BASE_URL: "http://localhost:9000/forgotten-letters-assets",
  };
}

function applyEnv(overrides: Record<string, string | undefined> = {}) {
  const merged = { ...validEnv(), ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

beforeEach(() => {
  vi.resetModules();
});

describe("env validation", () => {
  it("accepts a complete configuration", async () => {
    applyEnv();
    const { env } = await import("@/lib/env");
    expect(env.DATABASE_URL).toContain("forgotten_letters");
  });

  it("coerces numeric strings to numbers", async () => {
    applyEnv();
    const { env } = await import("@/lib/env");
    // Env vars are always strings; downstream code does arithmetic on
    // these, so a string would silently corrupt quota comparisons.
    expect(env.STORAGE_QUOTA_FREE_BYTES).toBe(52_428_800);
    expect(env.SES_SMTP_PORT).toBe(1025);
  });

  it('coerces "true"/"false" to real booleans', async () => {
    applyEnv({ R2_FORCE_PATH_STYLE: "false" });
    const { env } = await import("@/lib/env");
    // The string "false" is truthy — passing it straight to the S3
    // client would silently enable path-style addressing.
    expect(env.R2_FORCE_PATH_STYLE).toBe(false);
  });

  it("treats an empty string as absent for optional values", async () => {
    // .env files spell "unset" as FOO="". A plain .optional() still runs
    // the inner validators on "", so `cp .env.example .env.local` — what
    // the README instructs — failed to build on AUTH_SECRET's min(32).
    applyEnv({ AUTH_SECRET: "", R2_ACCOUNT_ID: "", SES_SMTP_USER: "" });
    const { env } = await import("@/lib/env");
    expect(() => env.DATABASE_URL).not.toThrow();
    expect(env.AUTH_SECRET).toBeUndefined();
  });

  it("still rejects a non-empty AUTH_SECRET that is too short", async () => {
    // The empty-string escape hatch must not weaken real validation.
    applyEnv({ AUTH_SECRET: "too-short" });
    const { env } = await import("@/lib/env");
    expect(() => env.AUTH_SECRET).toThrow(/AUTH_SECRET/);
  });

  it("throws on a malformed DATABASE_URL", async () => {
    applyEnv({ DATABASE_URL: "not-a-url" });
    const { env } = await import("@/lib/env");
    expect(() => env.DATABASE_URL).toThrow(/DATABASE_URL/);
  });

  it("names every missing variable in one error", async () => {
    applyEnv({ R2_ENDPOINT: undefined, EMAIL_FROM: undefined });
    const { env } = await import("@/lib/env");
    // One boot should report the full list, not fail one at a time.
    expect(() => env.R2_ENDPOINT).toThrow(/R2_ENDPOINT[\s\S]*EMAIL_FROM/);
  });

  it("requires AUTH_SECRET in production", async () => {
    applyEnv({ NODE_ENV: "production", AUTH_SECRET: undefined });
    const { env } = await import("@/lib/env");
    expect(() => env.DATABASE_URL).toThrow(/AUTH_SECRET is required in production/);
  });

  it("skips production guardrails during `next build`", async () => {
    // `next build` sets NODE_ENV=production. Enforcing runtime rules
    // there breaks building an image locally or in CI with MinIO
    // settings — building for production is not running in production.
    applyEnv({
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
      AUTH_SECRET: undefined,
      R2_FORCE_PATH_STYLE: "true",
    });
    const { env } = await import("@/lib/env");
    expect(() => env.DATABASE_URL).not.toThrow();
    delete process.env.NEXT_PHASE;
  });

  it("rejects MinIO path-style addressing in production", async () => {
    applyEnv({
      NODE_ENV: "production",
      AUTH_SECRET: "a".repeat(32),
      R2_FORCE_PATH_STYLE: "true",
    });
    const { env } = await import("@/lib/env");
    // Path-style is a MinIO-only setting; leaving it on in prod breaks
    // R2's virtual-host addressing.
    expect(() => env.DATABASE_URL).toThrow(/R2_FORCE_PATH_STYLE must be false/);
  });
});

describe("getPublicAssetUrl", () => {
  it("joins base and key without doubling slashes", async () => {
    applyEnv();
    const { getPublicAssetUrl } = await import("@/lib/storage/r2");
    expect(getPublicAssetUrl("maps/trench.png")).toBe(
      "http://localhost:9000/forgotten-letters-assets/maps/trench.png",
    );
  });

  it("normalizes a leading slash on the key and a trailing one on the base", async () => {
    applyEnv({
      NEXT_PUBLIC_ASSET_BASE_URL: "http://localhost:9000/forgotten-letters-assets/",
    });
    const { getPublicAssetUrl } = await import("@/lib/storage/r2");
    expect(getPublicAssetUrl("/maps/trench.png")).toBe(
      "http://localhost:9000/forgotten-letters-assets/maps/trench.png",
    );
  });
});
