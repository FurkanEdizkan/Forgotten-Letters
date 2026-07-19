/**
 * Phase 1 auth journeys.
 *
 * Runs against the real compose stack — a real Postgres row is created
 * and a real bcrypt hash compared. Each run registers a fresh user so
 * the suite is re-runnable without cleanup.
 */
import { expect, test } from "@playwright/test";

function freshUser() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    username: `probe${stamp}`.slice(0, 24),
    email: `probe${stamp}@test.local`,
    password: "correct-horse-battery",
  };
}

/** The form's own alert, not Next's route announcer (also role=alert). */
const formAlert = 'form p[role="alert"], p[role="alert"]';

test("register, log in, and reach a protected page", async ({ page }) => {
  const user = freshUser();

  await page.goto("/register");
  await page.fill("#username", user.username);
  await page.fill("#email", user.email);
  await page.fill("#password", user.password);
  await page.click('button[type="submit"]');
  await expect(page.getByText(/check your inbox/i)).toBeVisible({ timeout: 15_000 });

  await page.goto("/login");
  await page.fill("#email", user.email);
  await page.fill("#password", user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("/", { timeout: 15_000 });

  // Previously redirected to /login; now reachable.
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings/);
});

test("signed-out users are redirected away from protected routes", async ({ page }) => {
  const res = await page.goto("/settings");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fsettings/);
  expect(res?.status()).toBe(200);
});

test("wrong password is rejected", async ({ page }) => {
  const user = freshUser();

  await page.goto("/register");
  await page.fill("#username", user.username);
  await page.fill("#email", user.email);
  await page.fill("#password", user.password);
  await page.click('button[type="submit"]');
  await expect(page.getByText(/check your inbox/i)).toBeVisible({ timeout: 15_000 });

  await page.goto("/login");
  await page.fill("#email", user.email);
  await page.fill("#password", "definitely-not-the-password");
  await page.click('button[type="submit"]');

  await expect(page.locator(formAlert).first()).toContainText(
    /invalid email or password/i,
  );
  await expect(page).toHaveURL(/\/login/);
});

test("unknown email gives the same message as a wrong password", async ({ page }) => {
  // Distinct messages would let an attacker enumerate registered emails.
  await page.goto("/login");
  await page.fill("#email", `nobody${Date.now()}@test.local`);
  await page.fill("#password", "whatever-password-here");
  await page.click('button[type="submit"]');

  await expect(page.locator(formAlert).first()).toContainText(
    /invalid email or password/i,
  );
});

test("registering an existing email does not reveal that it is taken", async ({
  page,
}) => {
  const user = freshUser();

  await page.goto("/register");
  await page.fill("#username", user.username);
  await page.fill("#email", user.email);
  await page.fill("#password", user.password);
  await page.click('button[type="submit"]');
  await expect(page.getByText(/check your inbox/i)).toBeVisible({ timeout: 15_000 });

  // Same email, different username — must look identical to a new signup.
  await page.goto("/register");
  await page.fill("#username", `${user.username}x`.slice(0, 24));
  await page.fill("#email", user.email);
  await page.fill("#password", user.password);
  await page.click('button[type="submit"]');
  await expect(page.getByText(/check your inbox/i)).toBeVisible({ timeout: 15_000 });
});

test("duplicate username is rejected with a field error", async ({ page }) => {
  const user = freshUser();

  await page.goto("/register");
  await page.fill("#username", user.username);
  await page.fill("#email", user.email);
  await page.fill("#password", user.password);
  await page.click('button[type="submit"]');
  await expect(page.getByText(/check your inbox/i)).toBeVisible({ timeout: 15_000 });

  // Username is public, so collisions can be reported plainly.
  await page.goto("/register");
  await page.fill("#username", user.username);
  await page.fill("#email", `other${Date.now()}@test.local`);
  await page.fill("#password", user.password);
  await page.click('button[type="submit"]');
  await expect(page.locator("#username-error")).toContainText(/taken/i);
});

test("short password is rejected", async ({ page }) => {
  const user = freshUser();
  await page.goto("/register");
  await page.fill("#username", user.username);
  await page.fill("#email", user.email);
  await page.fill("#password", "short");
  await page.click('button[type="submit"]');
  await expect(page.locator("#password-error")).toContainText(
    /at least 12 characters/i,
  );
});
