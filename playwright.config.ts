/**
 * Playwright — end-to-end tests.
 *
 * Starts the dev server itself and reuses an already-running one locally,
 * so `npm run test:e2e` works with no manual setup. The backing services
 * (docker compose) must be up: pages that touch the database or storage
 * will fail without them.
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // A .only left in a spec silently narrows CI to one test; fail instead.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL,
    trace: "on-first-retry",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
