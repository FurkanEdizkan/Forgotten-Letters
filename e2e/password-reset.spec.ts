/**
 * Password reset journey.
 *
 * Reads the real reset link out of Mailpit rather than reaching into the
 * database, so the test exercises the same path a user does: request →
 * email → link → new password → sign in.
 */
import { expect, test, type APIRequestContext } from "@playwright/test";

const MAILPIT = "http://localhost:8025";

function freshUser() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    username: `reset${stamp}`.slice(0, 24),
    email: `reset${stamp}@test.local`,
    password: "correct-horse-battery",
    newPassword: "a-brand-new-passphrase",
  };
}

/** Most recent message sent to an address, with its body text. */
async function latestMessageTo(request: APIRequestContext, email: string) {
  const list = await request.get(
    `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
  );
  const { messages } = await list.json();
  if (!messages?.length) return null;
  const detail = await request.get(`${MAILPIT}/api/v1/message/${messages[0].ID}`);
  return detail.json();
}

async function register(
  page: import("@playwright/test").Page,
  u: ReturnType<typeof freshUser>,
) {
  await page.goto("/register");
  await page.fill("#username", u.username);
  await page.fill("#email", u.email);
  await page.fill("#password", u.password);
  await page.click('button[type="submit"]');
  await expect(page.getByText(/check your inbox/i)).toBeVisible({ timeout: 15_000 });
}

test("reset password end to end", async ({ page, request }) => {
  const user = freshUser();
  await register(page, user);

  await page.goto("/forgot-password");
  await page.fill("#email", user.email);
  await page.click('button[type="submit"]');
  await expect(page.getByText(/reset link is on its way/i)).toBeVisible();

  // Pull the real link out of the delivered email.
  const message = await expect
    .poll(async () => latestMessageTo(request, user.email), { timeout: 15_000 })
    .not.toBeNull()
    .then(() => latestMessageTo(request, user.email));

  const body: string = message.Text;
  const match = body.match(/(http:\/\/localhost:3000\/reset-password\S+)/);
  expect(match, "reset email should contain a link").toBeTruthy();

  await page.goto(match![1]);
  await page.fill("#password", user.newPassword);
  await page.fill("#confirmPassword", user.newPassword);
  await page.click('button[type="submit"]');
  await expect(page.getByText(/password changed/i)).toBeVisible({ timeout: 15_000 });

  // New password works.
  await page.goto("/login");
  await page.fill("#email", user.email);
  await page.fill("#password", user.newPassword);
  await page.click('button[type="submit"]');
  await page.waitForURL("/", { timeout: 15_000 });

  // Old password no longer does.
  await page.goto("/api/auth/signout");
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill("#email", user.email);
  await page.fill("#password", user.password);
  await page.click('button[type="submit"]');
  await expect(page.locator('p[role="alert"]').first()).toContainText(
    /invalid email or password/i,
  );
});

test("a reset token cannot be used twice", async ({ page, request }) => {
  const user = freshUser();
  await register(page, user);

  await page.goto("/forgot-password");
  await page.fill("#email", user.email);
  await page.click('button[type="submit"]');
  await expect(page.getByText(/reset link is on its way/i)).toBeVisible();

  const message = await expect
    .poll(async () => latestMessageTo(request, user.email), { timeout: 15_000 })
    .not.toBeNull()
    .then(() => latestMessageTo(request, user.email));

  const link = (message.Text as string).match(
    /(http:\/\/localhost:3000\/reset-password\S+)/,
  )![1];

  await page.goto(link);
  await page.fill("#password", user.newPassword);
  await page.fill("#confirmPassword", user.newPassword);
  await page.click('button[type="submit"]');
  await expect(page.getByText(/password changed/i)).toBeVisible({ timeout: 15_000 });

  // Same link again: the token was consumed in the same transaction as
  // the password change, so it must now be rejected.
  await page.goto(link);
  await page.fill("#password", "yet-another-passphrase");
  await page.fill("#confirmPassword", "yet-another-passphrase");
  await page.click('button[type="submit"]');
  await expect(page.locator('p[role="alert"]').first()).toContainText(
    /invalid or has expired/i,
  );
});

test("unknown email still reports success", async ({ page }) => {
  // Otherwise the form enumerates registered addresses.
  await page.goto("/forgot-password");
  await page.fill("#email", `nobody${Date.now()}@test.local`);
  await page.click('button[type="submit"]');
  await expect(page.getByText(/reset link is on its way/i)).toBeVisible();
});

test("mismatched confirmation is rejected", async ({ page }) => {
  await page.goto("/reset-password?token=abc&email=someone%40test.local");
  await page.fill("#password", "a-valid-long-password");
  await page.fill("#confirmPassword", "a-different-long-password");
  await page.click('button[type="submit"]');
  await expect(page.locator("#confirmPassword-error")).toContainText(/do not match/i);
});
