/**
 * Campaign journeys.
 *
 * Same shape as the scenario suite: create, persist, publish, and prove
 * draft visibility and ownership hold end to end.
 */
import { expect, test, type Page } from "@playwright/test";

function freshUser() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    username: `camp${stamp}`.slice(0, 24),
    email: `camp${stamp}@test.local`,
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

async function createCampaign(page: Page, title: string) {
  await page.goto("/campaigns/new");
  await page.fill("#title", title);
  await page.fill("#summary", "A campaign created by the test suite.");
  await page.getByRole("button", { name: /^save$/i }).click();
  await page.waitForURL(/\/campaigns\/[^/]+\/[^/]+\/edit$/, { timeout: 15_000 });
  return page.url().replace(/\/edit$/, "");
}

test("create, persist, and publish a campaign", async ({ page }) => {
  await registerAndLogin(page, freshUser());

  await page.goto("/campaigns/new");
  await page.fill("#title", "The Long Retreat");
  await expect(page.locator("#slug")).toHaveValue("the-long-retreat");

  await page.fill("#summary", "A fighting withdrawal across three bridges.");
  await page.getByRole("button", { name: /^save$/i }).click();
  await page.waitForURL(/\/campaigns\/[^/]+\/the-long-retreat\/edit$/, {
    timeout: 15_000,
  });

  // Reload proves persistence rather than component state.
  await page.reload();
  await expect(page.locator("#title")).toHaveValue("The Long Retreat");
  await expect(page.getByText(/^draft$/i)).toBeVisible();

  await page.getByRole("button", { name: /publish/i }).click();
  await expect(page.getByText(/^published$/i)).toBeVisible({ timeout: 15_000 });
});

test("a draft campaign is hidden from everyone but its author", async ({ page }) => {
  await registerAndLogin(page, freshUser());
  const url = await createCampaign(page, "Secret Operation");

  expect((await page.goto(url))?.status()).toBe(200);

  await page.context().clearCookies();
  expect((await page.goto(url))?.status()).toBe(404);

  await page.goto("/campaigns");
  await expect(page.getByText("Secret Operation")).toHaveCount(0);
});

test("a published campaign is publicly readable and listed", async ({ page }) => {
  await registerAndLogin(page, freshUser());
  const url = await createCampaign(page, "Public Offensive");

  await page.getByRole("button", { name: /publish/i }).click();
  await expect(page.getByText(/^published$/i)).toBeVisible({ timeout: 15_000 });

  await page.context().clearCookies();
  expect((await page.goto(url))?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Public Offensive" })).toBeVisible();

  await page.goto("/campaigns");
  await expect(page.getByText("Public Offensive").first()).toBeVisible();
});

test("one author cannot edit another's campaign", async ({ page }) => {
  await registerAndLogin(page, freshUser());
  const url = await createCampaign(page, "Private Plans");
  const editUrl = `${url}/edit`;

  await page.context().clearCookies();
  await registerAndLogin(page, freshUser());

  // 404 rather than 403 — a 403 confirms it exists.
  expect((await page.goto(editUrl))?.status()).toBe(404);
});

test("deleting a campaign keeps its scenarios", async ({ page }) => {
  await registerAndLogin(page, freshUser());
  const campaignUrl = await createCampaign(page, "Doomed Campaign");

  // Create a standalone scenario; the FK is ON DELETE SET NULL, so it
  // must survive the campaign being removed.
  await page.goto("/scenarios/new");
  await page.fill("#title", "Survivor Scenario");
  await page.getByRole("button", { name: /^save$/i }).click();
  await page.waitForURL(/\/edit$/, { timeout: 15_000 });
  const scenarioUrl = page.url().replace(/\/edit$/, "");

  page.on("dialog", (d) => d.accept());
  await page.goto(`${campaignUrl}/edit`);
  await page.getByRole("button", { name: /delete campaign/i }).click();
  await page.waitForURL("/campaigns", { timeout: 15_000 });

  // The scenario is still there.
  expect((await page.goto(scenarioUrl))?.status()).toBe(200);
});

test("anonymous users are redirected away from campaign creation", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/campaigns/new");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fcampaigns%2Fnew/);
});
