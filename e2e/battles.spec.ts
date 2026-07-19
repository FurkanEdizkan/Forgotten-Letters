/**
 * Battle tracker.
 *
 * The authorization question that matters: only the campaign owner may
 * record or delete battles, and the log is readable by anyone who can
 * read the campaign.
 */
import { expect, test, type Page } from "@playwright/test";

function freshUser() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    username: `btl${stamp}`.slice(0, 24),
    email: `btl${stamp}@test.local`,
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
  // Confirm the session is this user before doing per-user work.
  await expect(
    page.getByRole("button", { name: new RegExp(u.username, "i") }),
  ).toBeVisible({ timeout: 15_000 });
}

/** Create and publish a campaign; return its public URL. */
async function publishCampaign(page: Page, title: string) {
  await page.goto("/campaigns/new");
  await page.fill("#title", title);
  await page.getByRole("button", { name: /^save$/i }).click();
  await page.waitForURL(/\/campaigns\/[^/]+\/[^/]+\/edit$/, { timeout: 15_000 });
  await page.getByRole("button", { name: /publish/i }).click();
  await expect(page.getByText(/^published$/i)).toBeVisible({ timeout: 15_000 });
  return page.url().replace(/\/edit$/, "");
}

async function recordBattle(page: Page, winner: string, loser: string) {
  await page.getByRole("button", { name: /record a battle/i }).click();
  await page.getByLabel("Participant 1 name").fill(winner);
  await page.getByLabel("Participant 2 name").fill(loser);
  await page.getByLabel("Participant 1 score").fill("12");
  await page.fill("#battle-notes", "Decided on the last turn.");
  await page.getByRole("button", { name: /save battle/i }).click();
}

test("the owner records a battle and it appears in the log", async ({ page }) => {
  await registerAndLogin(page, freshUser());
  const url = await publishCampaign(page, "Tracked Campaign");

  await page.goto(url);
  await expect(page.getByText(/no battles recorded yet/i)).toBeVisible();

  await recordBattle(page, "The Iron Choir", "Rust Legion");

  await expect(page.getByText("The Iron Choir")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Rust Legion")).toBeVisible();
  await expect(page.getByText("Decided on the last turn.")).toBeVisible();
  await expect(page.getByText("12")).toBeVisible();
});

test("visitors can read the log but not record or delete", async ({ page }) => {
  await registerAndLogin(page, freshUser());
  const url = await publishCampaign(page, "Read Only Campaign");
  await page.goto(url);
  await recordBattle(page, "Alpha Warband", "Beta Warband");
  await expect(page.getByText("Alpha Warband")).toBeVisible({ timeout: 15_000 });

  // Anonymous visitor.
  await page.context().clearCookies();
  await page.goto(url);
  await expect(page.getByText("Alpha Warband")).toBeVisible();
  await expect(page.getByRole("button", { name: /record a battle/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /delete battle/i })).toHaveCount(0);

  // A different signed-in user also gets no controls.
  await registerAndLogin(page, freshUser());
  await page.goto(url);
  await expect(page.getByText("Alpha Warband")).toBeVisible();
  await expect(page.getByRole("button", { name: /record a battle/i })).toHaveCount(0);
});

test("the owner can delete a battle", async ({ page }) => {
  await registerAndLogin(page, freshUser());
  const url = await publishCampaign(page, "Deletable Battles Campaign");
  await page.goto(url);
  await recordBattle(page, "Doomed Entry", "Other Side");
  await expect(page.getByText("Doomed Entry")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /delete battle/i }).click();
  await expect(page.getByText("Doomed Entry")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByText(/no battles recorded yet/i)).toBeVisible();
});

test("a battle needs at least two participants", async ({ page }) => {
  await registerAndLogin(page, freshUser());
  const url = await publishCampaign(page, "Validation Campaign");
  await page.goto(url);

  await page.getByRole("button", { name: /record a battle/i }).click();
  await page.getByLabel("Participant 1 name").fill("Only One Side");
  // Second left blank — a one-sided battle records nothing meaningful.
  await page.getByRole("button", { name: /save battle/i }).click();

  await expect(page.locator('p[role="alert"]').first()).toContainText(
    /at least two sides/i,
  );
});

test("deleting a campaign removes its battles", async ({ page }) => {
  await registerAndLogin(page, freshUser());
  const url = await publishCampaign(page, "Cascade Battles Campaign");
  await page.goto(url);
  await recordBattle(page, "Will Vanish", "Also Vanishes");
  await expect(page.getByText("Will Vanish")).toBeVisible({ timeout: 15_000 });

  page.on("dialog", (d) => d.accept());
  await page.goto(`${url}/edit`);
  await page.getByRole("button", { name: /delete campaign/i }).click();
  await page.waitForURL("/campaigns", { timeout: 15_000 });

  // Battles cascade with the campaign — nothing orphaned.
  expect((await page.goto(url))?.status()).toBe(404);
});
