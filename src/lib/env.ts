/**
 * Validated environment configuration.
 *
 * Every env var the app reads passes through here. Importing this module
 * throws immediately on missing or malformed values, so the app fails at
 * boot with a readable list rather than at 3am with `undefined is not a
 * function` deep inside a request. See docs/BuildPlan.md §A3.
 *
 * Only variables Phase 0 actually consumes are required. Everything else
 * (Stripe, ads, AI Forge) is optional here and gets promoted to required
 * by the phase that introduces it — requiring them now would block local
 * development on credentials nobody has yet.
 */
import { z } from "zod";

/** Coerce the "true"/"false" strings env vars carry into real booleans. */
const boolish = z.enum(["true", "false"]).transform((v) => v === "true");

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // ── Database ──────────────────────────────────────────────
  DATABASE_URL: z
    .string()
    .url("DATABASE_URL must be a valid postgresql:// connection string"),

  // ── Auth.js ───────────────────────────────────────────────
  // Required in production only: a missing secret in prod is a
  // security failure, but demanding one before Phase 1 wires auth
  // would block `npm run dev` on a value nothing reads yet.
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_URL: z.string().url().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),

  // ── Object storage (MinIO locally, R2 in prod) ────────────
  R2_ENDPOINT: z.string().url(),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_REGION: z.string().default("auto"),
  R2_FORCE_PATH_STYLE: boolish.default(false),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_BUCKET_ASSETS: z.string().min(1),
  R2_BUCKET_AVATARS: z.string().min(1),
  STORAGE_QUOTA_FREE_BYTES: z.coerce.number().int().positive(),

  // ── Email (Mailpit locally, SES in prod) ──────────────────
  SES_SMTP_HOST: z.string().min(1),
  SES_SMTP_PORT: z.coerce.number().int().positive(),
  // Mailpit accepts any credentials, so these stay optional.
  SES_SMTP_USER: z.string().optional(),
  SES_SMTP_PASSWORD: z.string().optional(),
  SES_SMTP_SECURE: boolish.default(false),
  EMAIL_FROM: z.string().min(1),
});

/**
 * Client-exposed vars. Next.js inlines NEXT_PUBLIC_* at build time, so
 * these must be referenced by their full literal name — destructuring
 * `process.env` would leave them undefined in the browser bundle.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_ASSET_BASE_URL: z.string().url(),
});

function format(error: z.ZodError): string {
  const lines = error.issues.map(
    (i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`,
  );
  return `Invalid environment configuration:\n${lines.join("\n")}\n\nCheck .env.local against .env.example.`;
}

const clientParsed = clientSchema.safeParse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_ASSET_BASE_URL: process.env.NEXT_PUBLIC_ASSET_BASE_URL,
});

if (!clientParsed.success) {
  throw new Error(format(clientParsed.error));
}

export const clientEnv = clientParsed.data;

/**
 * Server-only configuration.
 *
 * Accessed through a Proxy rather than parsed eagerly so that importing
 * this module from a client component does not throw — the client bundle
 * has no DATABASE_URL and would fail validation at build time. Touching a
 * server value in the browser throws a targeted error instead.
 */
function loadServerEnv() {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(format(parsed.error));
  }

  // Guardrails that only apply once real traffic is involved.
  //
  // `next build` runs with NODE_ENV=production, so these must be skipped
  // during the build — otherwise building an image on a laptop (or in CI)
  // with local MinIO settings fails on rules meant for a deployed server.
  // Building for production is not the same as running in production.
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

  if (parsed.data.NODE_ENV === "production" && !isBuildPhase) {
    if (!parsed.data.AUTH_SECRET) {
      throw new Error(
        "AUTH_SECRET is required in production. Generate one with: openssl rand -base64 32",
      );
    }
    if (parsed.data.R2_FORCE_PATH_STYLE) {
      throw new Error(
        "R2_FORCE_PATH_STYLE must be false in production — it is a MinIO-only setting and breaks Cloudflare R2's virtual-host addressing.",
      );
    }
  }

  return parsed.data;
}

type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

export const env: ServerEnv = new Proxy({} as ServerEnv, {
  get(_target, prop: string) {
    if (typeof window !== "undefined") {
      throw new Error(
        `Attempted to read server env "${prop}" in the browser. Use clientEnv (NEXT_PUBLIC_*) instead.`,
      );
    }
    cached ??= loadServerEnv();
    return cached[prop as keyof ServerEnv];
  },
});
