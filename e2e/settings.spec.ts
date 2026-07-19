/**
 * Settings journeys.
 *
 * Includes account deletion, which cascades across every table the user
 * owns — so the confirmation gate is tested as carefully as the delete.
 */
import { expect, test, type Page } from "@playwright/test";

function freshUser() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    username: `set${stamp}`.slice(0, 24),
    email: `set${stamp}@test.local`,
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

test("edit profile and see it on the public page", async ({ page }) => {
  const user = freshUser();
  await registerAndLogin(page, user);

  await page.goto("/settings/profile");
  await page.fill("#displayName", "Gunnery Sergeant");
  await page.fill("#bio", "Keeps the guns fed.");
  await page.getByRole("button", { name: /save profile/i }).click();
  await expect(page.getByText(/profile saved/i)).toBeVisible({ timeout: 15_000 });

  await page.goto(`/user/${user.username}`);
  await expect(page.getByRole("heading", { name: "Gunnery Sergeant" })).toBeVisible();
  await expect(page.getByText("Keeps the guns fed.")).toBeVisible();
});

test("changing username moves the profile URL", async ({ page }) => {
  const user = freshUser();
  await registerAndLogin(page, user);

  const newName = `${user.username}x`.slice(0, 24);
  await page.goto("/settings/profile");
  await page.fill("#username", newName);
  await page.getByRole("button", { name: /save profile/i }).click();
  await expect(page.getByText(/profile saved/i)).toBeVisible({ timeout: 15_000 });

  expect((await page.goto(`/user/${newName}`))?.status()).toBe(200);
  // The old URL is genuinely gone, not silently redirected.
  expect((await page.goto(`/user/${user.username}`))?.status()).toBe(404);
});

test("a taken username is rejected", async ({ page }) => {
  const first = freshUser();
  await registerAndLogin(page, first);

  await page.context().clearCookies();
  const second = freshUser();
  await registerAndLogin(page, second);

  await page.goto("/settings/profile");
  await page.fill("#username", first.username);
  await page.getByRole("button", { name: /save profile/i }).click();

  // Usernames are public, so a collision can be reported plainly.
  await expect(page.locator("#username-error")).toContainText(/taken/i);
});

test("bio markup is stripped, not stored", async ({ page }) => {
  const user = freshUser();
  await registerAndLogin(page, user);

  await page.goto("/settings/profile");
  await page.fill("#bio", "<script>alert(1)</script>plain bio text");
  await page.getByRole("button", { name: /save profile/i }).click();
  await expect(page.getByText(/profile saved/i)).toBeVisible({ timeout: 15_000 });

  await page.goto(`/user/${user.username}`);
  await expect(page.getByText("plain bio text")).toBeVisible();
  // .last(): the navbar is also a <header>.
  const html = await page.locator("header").last().innerHTML();
  expect(html).not.toContain("<script");
});

test("storage page reports real quota", async ({ page }) => {
  await registerAndLogin(page, freshUser());

  await page.goto("/settings/storage");
  // 50 MB free-tier default from the entitlements row.
  await expect(page.getByText(/of 50\.0 MB used/i)).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByText(/no uploads yet/i)).toBeVisible();
});

test("delete is blocked until the email is typed exactly", async ({ page }) => {
  const user = freshUser();
  await registerAndLogin(page, user);

  await page.goto("/settings/account");
  const button = page.getByRole("button", { name: /delete my account/i });

  // Disabled with an empty field, and with a near-miss.
  await expect(button).toBeDisabled();
  await page.fill("#confirmation", user.email.toUpperCase());
  await expect(button).toBeDisabled();

  await page.fill("#confirmation", user.email);
  await expect(button).toBeEnabled();
});

test("deleting an account removes it and its content", async ({ page }) => {
  const user = freshUser();
  await registerAndLogin(page, user);

  // Publish something so the cascade has work to do.
  await page.goto("/scenarios/new");
  await page.fill("#title", "Doomed With The Account");
  await page.getByRole("button", { name: /^save$/i }).click();
  await page.waitForURL(/\/edit$/, { timeout: 15_000 });
  await page.getByRole("button", { name: /publish/i }).click();
  await expect(page.getByText(/^published$/i)).toBeVisible({ timeout: 15_000 });
  const scenarioUrl = page.url().replace(/\/edit$/, "");

  await page.goto("/settings/account");
  await page.fill("#confirmation", user.email);
  await page.getByRole("button", { name: /delete my account/i }).click();
  await page.waitForURL("/", { timeout: 15_000 });

  // Profile and scenario both gone via the cascade.
  expect((await page.goto(`/user/${user.username}`))?.status()).toBe(404);
  expect((await page.goto(scenarioUrl))?.status()).toBe(404);

  // The session must have been cleared by the delete: sessions are
  // JWTs, so without an explicit signOut the cookie outlives the
  // account and middleware would redirect this /login visit away.
  await page.goto("/login");
  await page.fill("#email", user.email);
  await page.fill("#password", user.password);
  await page.click('button[type="submit"]');
  await expect(page.locator('p[role="alert"]').first()).toContainText(
    /invalid email or password/i,
  );
});

test("settings require a session", async ({ page }) => {
  await page.context().clearCookies();
  for (const path of ["/settings/profile", "/settings/account", "/settings/storage"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  }
});
