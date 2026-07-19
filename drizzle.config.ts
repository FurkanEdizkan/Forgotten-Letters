/**
 * Drizzle Kit configuration (migration generation + studio).
 *
 * Migrations are written to db/migrations/ rather than the drizzle/
 * default, per docs/Architecture.md — the SQL files are reviewed like any
 * other change, so they live in a predictable top-level directory.
 *
 * This file runs in the plain Node CLI, outside Next.js, so it reads
 * .env.local itself rather than going through src/lib/env.ts (which is
 * bundler-aware and expects Next's env loading).
 */
import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local before running drizzle-kit.",
  );
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  // Surface the SQL that drizzle-kit is about to run.
  verbose: true,
  // Prompt before destructive operations rather than silently dropping.
  strict: true,
});
