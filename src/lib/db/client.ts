/**
 * Drizzle database client.
 *
 * A single pooled client is reused across requests. In development Next.js
 * hot-reload re-evaluates modules on every edit, which would open a new
 * pool each time and exhaust Postgres connections within a few saves — so
 * the pool is stashed on globalThis there. Production gets a plain module
 * singleton.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    // Keep well under Postgres' default max_connections (100); the app
    // may run several containers against one database.
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

if (env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });

/** Liveness probe for /api/health. Returns false rather than throwing. */
export async function pingDb(): Promise<boolean> {
  try {
    const client = await pool.connect();
    try {
      await client.query("select 1");
      return true;
    } finally {
      client.release();
    }
  } catch {
    return false;
  }
}
