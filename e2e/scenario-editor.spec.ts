/**
 * Scenario editor journeys.
 *
 * Creates real rows through the real actions, so this proves the whole
 * chain — form, validation, sanitization, database — rather than that
 * the form renders.
 */
import { expect, test, type Page } from "@playwright/test";

function freshUser() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    username: `author${stamp}`.slice(0, 24),
    email: `author${stamp}@test.local`,
    password: "correct-horse-battery",
  };
}

async function registerAndLogin(page: Page, u: ReturnType<typeof freshUser>) {
  await page.goto("/register");
  await page.fill("#username", u.username);
  await page.fill("#email", u.email);
  await page.fill("#password", u.password);
  await page.click('button[type="submit"]');
  await expect(page.getByText(/check your inbox/i)).toBeVisible({ timeout: 15_000 });

  await page.goto("/login");
  await page.fill("#email", u.email);
  await page.fill("#password", u.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("/", { timeout: 15_000 });
}

test("create a scenario, then edit and publish it", async ({ page }) => {
  await registerAndLogin(page, freshUser());

  await page.goto("/scenarios/new");
  await expect(page.getByRole("heading", { name: /forge a scenario/i })).toBeVisible();

  await page.fill("#title", "The Sunken Chapel");
  // Slug should have auto-filled from the title.
  await expect(page.locator("#slug")).toHaveValue("the-sunken-chapel");

  await page.fill("#summary", "A crossing contested in the dark.");
  await page.fill("#players", "2");
  await page.fill("#minutes", "90");

  await page.getByRole("tab", { name: /sections/i }).click();
  await page.getByLabel("Section 1 heading").fill("Premise");
  await page.getByLabel("Section 1 body").fill("Two warbands meet at a flooded ford.");

  await page.getByRole("button", { name: /^save$/i }).click();

  // Creating redirects into the edit route for the new scenario.
  await page.waitForURL(/\/scenarios\/the-sunken-chapel\/edit/, { timeout: 15_000 });
  await expect(page.getByText(/^draft$/i)).toBeVisible();

  // Reload proves it persisted rather than living in component state.
  await page.reload();
  await expect(page.locator("#title")).toHaveValue("The Sunken Chapel");
  await page.getByRole("tab", { name: /sections/i }).click();
  await expect(page.getByLabel("Section 1 body")).toHaveValue(
    "Two warbands meet at a flooded ford.",
  );

  await page.getByRole("button", { name: /publish/i }).click();
  await expect(page.getByText(/^published$/i)).toBeVisible({ timeout: 15_000 });
});

test("validation errors are shown per field", async ({ page }) => {
  await registerAndLogin(page, freshUser());

  await page.goto("/scenarios/new");
  await page.fill("#title", "ab"); // below the 3-character minimum
  await page.getByRole("button", { name: /^save$/i }).click();

  await expect(page.locator('p[role="alert"]').first()).toContainText(
    /correct the errors/i,
  );
  await expect(page.locator("#title-error")).toContainText(/at least 3 characters/i);
});

test("event tables round-trip", async ({ page }) => {
  await registerAndLogin(page, freshUser());

  await page.goto("/scenarios/new");
  await page.fill("#title", "Table Test Scenario");

  await page.getByRole("tab", { name: /event tables/i }).click();
  await page.getByRole("button", { name: /add event table/i }).click();
  await page.getByLabel("Event table 1 title").fill("Weather");
  await page.getByLabel("Event table 1 dice").fill("d6");
  await page.getByRole("button", { name: /add row/i }).click();
  await page.getByLabel("Entry 1 result").fill("Driving rain");

  await page.getByRole("button", { name: /^save$/i }).click();
  await page.waitForURL(/\/edit/, { timeout: 15_000 });

  await page.reload();
  await page.getByRole("tab", { name: /event tables/i }).click();
  await expect(page.getByLabel("Event table 1 title")).toHaveValue("Weather");
  await expect(page.getByLabel("Entry 1 result")).toHaveValue("Driving rain");
});

test("one author cannot open another's edit page", async ({ page }) => {
  const owner = freshUser();
  await registerAndLogin(page, owner);

  await page.goto("/scenarios/new");
  await page.fill("#title", "Private Draft Scenario");
  await page.getByRole("button", { name: /^save$/i }).click();
  await page.waitForURL(/\/scenarios\/private-draft-scenario\/edit/, {
    timeout: 15_000,
  });

  // Sign out and register a different account.
  await page.context().clearCookies();
  await registerAndLogin(page, freshUser());

  // 404, not 403 — a 403 would confirm the scenario exists.
  const res = await page.goto("/scenarios/private-draft-scenario/edit");
  expect(res?.status()).toBe(404);
});

test("anonymous users are redirected away from the editor", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/scenarios/new");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fscenarios%2Fnew/);
});
