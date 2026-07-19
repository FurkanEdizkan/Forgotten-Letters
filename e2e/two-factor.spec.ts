/**
 * Two-factor authentication.
 *
 * The code the authenticator app would show is computed in-test from the
 * secret the enrolment screen displays, so this exercises the real TOTP
 * path rather than a stub.
 */
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";

function freshUser() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    username: `tfa${stamp}`.slice(0, 24),
    email: `tfa${stamp}@test.local`,
    password: "correct-horse-battery",
  };
}

async function register(page: Page, u: ReturnType<typeof freshUser>) {
  await page.goto("/register");
  await page.fill("#username", u.username);
  await page.fill("#email", u.email);
  await page.fill("#password", u.password);
  await page.click('button[type="submit"]');
  await expect(page.getByText(/check your inbox/i)).toBeVisible({ timeout: 15_000 });
}

async function login(page: Page, u: ReturnType<typeof freshUser>, totp = "") {
  await page.goto("/login");
  await page.fill("#email", u.email);
  await page.fill("#password", u.password);
  if (totp) await page.fill("#totp", totp);
  await page.click('button[type="submit"]');
}

function codeFor(secret: string): string {
  return new OTPAuth.TOTP({
    issuer: "Forgotten Letters",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate();
}

/** Enrol and return the secret plus the recovery codes shown once. */
async function enable2fa(page: Page) {
  await page.goto("/settings/account");
  await page.getByRole("button", { name: /set up two-factor/i }).click();

  const secret = (await page.locator("#totp-secret").textContent())!.trim();
  await page.fill("#totp-code", codeFor(secret));
  await page.getByRole("button", { name: /verify and enable/i }).click();

  await expect(page.getByText(/save your recovery codes/i)).toBeVisible({
    timeout: 15_000,
  });

  const recovery = await page
    .locator("li")
    .filter({ hasText: /^[0-9a-f]{5}-/ })
    .allTextContents();
  return { secret, recovery: recovery.map((c) => c.trim()) };
}

test("enrol, then sign in with a code", async ({ page }) => {
  const user = freshUser();
  await register(page, user);
  await login(page, user);
  await page.waitForURL("/", { timeout: 15_000 });

  const { secret } = await enable2fa(page);
  await expect(page.getByText(/enabled\. you will be asked/i)).toBeVisible();

  await page.context().clearCookies();

  // Password alone must not be enough any more.
  await login(page, user);
  await expect(page.locator('p[role="alert"]').first()).toContainText(
    /invalid email or password/i,
  );

  // With a code it works.
  await login(page, user, codeFor(secret));
  await page.waitForURL("/", { timeout: 15_000 });
});

test("a wrong code is rejected", async ({ page }) => {
  const user = freshUser();
  await register(page, user);
  await login(page, user);
  await page.waitForURL("/", { timeout: 15_000 });
  await enable2fa(page);

  await page.context().clearCookies();
  await login(page, user, "000000");
  await expect(page.locator('p[role="alert"]').first()).toContainText(
    /invalid email or password/i,
  );
});

test("a recovery code works once and is then spent", async ({ page }) => {
  const user = freshUser();
  await register(page, user);
  await login(page, user);
  await page.waitForURL("/", { timeout: 15_000 });
  const { recovery } = await enable2fa(page);
  expect(recovery.length).toBeGreaterThan(0);

  await page.context().clearCookies();
  await login(page, user, recovery[0]);
  await page.waitForURL("/", { timeout: 15_000 });

  // Reusing it must fail — a replayable code is a permanent bypass.
  await page.context().clearCookies();
  await login(page, user, recovery[0]);
  await expect(page.locator('p[role="alert"]').first()).toContainText(
    /invalid email or password/i,
  );

  // A different, unused code still works.
  await login(page, user, recovery[1]);
  await page.waitForURL("/", { timeout: 15_000 });
});

test("abandoning setup does not enable 2FA", async ({ page }) => {
  const user = freshUser();
  await register(page, user);
  await login(page, user);
  await page.waitForURL("/", { timeout: 15_000 });

  // Start enrolment, never verify.
  await page.goto("/settings/account");
  await page.getByRole("button", { name: /set up two-factor/i }).click();
  await expect(page.locator("#totp-secret")).toBeVisible();

  // Password-only login must still work, or a mis-scan locks the user out.
  await page.context().clearCookies();
  await login(page, user);
  await page.waitForURL("/", { timeout: 15_000 });
});

test("disabling requires a valid code", async ({ page }) => {
  const user = freshUser();
  await register(page, user);
  await login(page, user);
  await page.waitForURL("/", { timeout: 15_000 });
  const { secret } = await enable2fa(page);

  await page.goto("/settings/account");
  await page.fill("#totp-disable", "000000");
  await page.getByRole("button", { name: /^disable$/i }).click();
  await expect(page.locator('p[role="alert"]').first()).toContainText(/not valid/i);

  // Correct code turns it off.
  await page.fill("#totp-disable", codeFor(secret));
  await page.getByRole("button", { name: /^disable$/i }).click();
  await expect(page.getByText(/add a code from an authenticator/i)).toBeVisible({
    timeout: 15_000,
  });

  // And password-only login works again.
  await page.context().clearCookies();
  await login(page, user);
  await page.waitForURL("/", { timeout: 15_000 });
});
