/**
 * Idempotent seed.
 *
 * Safe to re-run: every insert is conflict-guarded, so this can be part
 * of a normal dev bootstrap rather than a one-shot.
 *
 *   npm run db:seed
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../../src/lib/db/schema";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
}

const pool = new Pool({ connectionString: url });
const db = drizzle(pool, { schema });

async function main() {
  const [system] = await db
    .insert(schema.gameSystems)
    .values({
      slug: "trench-crusade",
      name: "Trench Crusade",
      publisher: "Trench Crusade",
      description:
        "Grimdark alternate-history skirmish wargame. Community scenarios only — " +
        "rules and IP remain the property of the publisher.",
    })
    .onConflictDoNothing({ target: schema.gameSystems.slug })
    .returning();

  if (system) {
    console.log(`seeded game system: ${system.slug}`);
  } else {
    console.log("game system already present, skipping");
  }

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
