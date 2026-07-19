/**
 * Phase 0 smoke tests.
 *
 * Proves the app boots, renders, and can reach every backing service.
 * Feature journeys (register → verify → login, scenario CRUD, uploads)
 * arrive with the phases that build them.
 */
import { expect, test } from "@playwright/test";

test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Forgotten Letters/i);
  await expect(page.locator("body")).toBeVisible();
});

test("health endpoint reports every service reachable", async ({ request }) => {
  const res = await request.get("/api/health");

  // A 503 here means a container is down, not that the app is broken —
  // check `docker compose ps` before debugging the code.
  expect(res.status(), "health returned non-200; are the compose services up?").toBe(200);

  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.checks).toEqual({ database: true, storage: true, mail: true });
});

test("health endpoint is never cached", async ({ request }) => {
  // A cached health check would report a dead service as alive.
  const res = await request.get("/api/health");
  expect(res.headers()["cache-control"]).toContain("no-store");
});

test("public routes render", async ({ page }) => {
  for (const path of ["/scenarios", "/campaigns", "/rules", "/login"]) {
    const res = await page.goto(path);
    expect(res?.status(), `${path} did not return 200`).toBe(200);
  }
});

test("unknown route returns 404", async ({ page }) => {
  const res = await page.goto("/definitely-not-a-real-page");
  expect(res?.status()).toBe(404);
});
