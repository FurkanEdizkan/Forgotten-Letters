/**
 * Vitest — unit and integration tests.
 *
 * Integration tests run against the real compose Postgres and MinIO
 * rather than mocks, so framework behavior is genuinely exercised
 * (docs/BuildPlan.md, Testing strategy). That means `docker compose up`
 * is a prerequisite for the integration suite; pure unit tests run
 * anywhere.
 *
 * e2e/ is excluded here — those are Playwright specs and would fail if
 * Vitest tried to collect them.
 */
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Vitest does not do Next's .env loading, so integration tests would see
// no DATABASE_URL and fail at import. Loaded here rather than in a setup
// file because src/lib/env.ts validates at module load — by the time a
// setup file ran, the import would already have thrown.
config({ path: ".env.local" });

export default defineConfig({
  // Resolves the "@/*" alias from tsconfig.json. Native since Vite 7 —
  // the vite-tsconfig-paths plugin is no longer needed.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts", "tests/**/*.{test,spec}.ts"],
    exclude: ["node_modules/**", ".next/**", "e2e/**", "design-lab/**"],
    // Integration tests hit real containers; the default 5s is tight
    // for a cold pool or a first S3 round trip.
    testTimeout: 20_000,
    // Integration tests share one database. Running files in parallel
    // would interleave their fixtures; the suites are fast, so serialize.
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
    },
  },
});
