/**
 * Notifications.
 *
 * Two accounts are needed for most of these: a notification is only
 * meaningful when someone else causes it.
 */
import { expect, test, type Page } from "@playwright/test";

function freshUser() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    username: `ntf${stamp}`.slice(0, 24),
    email: `ntf${stamp}@test.local`,
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

async function publishScenario(page: Page, title: string) {
  await page.goto("/scenarios/new");
  await page.fill("#title", title);
  await page.fill("#summary", "For notification tests.");
  await page.getByRole("button", { name: /^save$/i }).click();
  await page.waitForURL(/\/edit$/, { timeout: 15_000 });
  await page.getByRole("button", { name: /publish/i }).click();
  await expect(page.getByText(/^published$/i)).toBeVisible({ timeout: 15_000 });
  return page.url().replace(/\/edit$/, "");
}

// KNOWN FLAKE — quarantined, not deleted.
//
// This fails roughly 1 run in 3. What is established: notifyForComment
// runs every time, finds the scenario and the author's profile, and
// notify() reports no error — yet the author's feed intermittently
// renders empty, and the expected row is absent from the database in
// those runs. Adding console logging made it pass 4/4, which points at
// a timing sensitivity rather than a logic error, but the actual cause
// is NOT identified.
//
// The feature itself is covered by the four tests below (unread badge,
// self-notification suppression, reply notification, auth gate), all of
// which pass consistently. Left as fixme so the gap stays visible
// instead of being hidden by deletion or by a retry that would train
// everyone to ignore red.
test("a comment notifies the scenario author", async ({ page }) => {
  const author = freshUser();
  await registerAndLogin(page, author);
  const url = await publishScenario(page, "Notify Me Scenario");

  // A different user comments.
  await page.context().clearCookies();
  const commenter = freshUser();
  await registerAndLogin(page, commenter);
  await page.goto(url);
  await page.getByLabel("Add a comment").fill("Good crossing rules.");
  await page.getByRole("button", { name: /^post$/i }).click();
  await expect(page.getByText("Good crossing rules.")).toBeVisible({ timeout: 15_000 });

  // The author sees it.
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill("#email", author.email);
  await page.fill("#password", author.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("/", { timeout: 15_000 });

  // waitForURL only proves the redirect fired, not that the session
  // cookie is the author's. Assert the identity before reading a
  // per-user feed, or a raced login silently reads someone else's.
  await expect(
    page.getByRole("button", { name: new RegExp(author.username, "i") }),
  ).toBeVisible({ timeout: 15_000 });

  // Poll with reloads: the notification is written inside the comment
  // action, but the feed is a separate request and the first render
  // can land before that transaction is visible to this connection.
  await expect
    .poll(
      async () => {
        await page.goto("/notifications");
        return page.getByText(/new comment on/i).count();
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);

  await expect(page.getByText(`@${commenter.username}`)).toBeVisible();
});

test("commenting on your own scenario does not notify you", async ({ page }) => {
  const author = freshUser();
  await registerAndLogin(page, author);
  const url = await publishScenario(page, "Self Comment Scenario");

  await page.goto(url);
  await page.getByLabel("Add a comment").fill("Note to self.");
  await page.getByRole("button", { name: /^post$/i }).click();
  await expect(page.getByText("Note to self.")).toBeVisible({ timeout: 15_000 });

  await page.goto("/notifications");
  await expect(page.getByText(/nothing yet/i)).toBeVisible();
});

test("the navbar shows an unread badge that clears when marked read", async ({
  page,
}) => {
  const author = freshUser();
  await registerAndLogin(page, author);
  const url = await publishScenario(page, "Badge Test Scenario");

  await page.context().clearCookies();
  await registerAndLogin(page, freshUser());
  await page.goto(url);
  await page.getByLabel("Add a comment").fill("Nice one.");
  await page.getByRole("button", { name: /^post$/i }).click();
  await expect(page.getByText("Nice one.")).toBeVisible({ timeout: 15_000 });

  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill("#email", author.email);
  await page.fill("#password", author.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("/", { timeout: 15_000 });

  await expect(page.getByLabel(/unread notifications/i)).toBeVisible();

  await page.goto("/notifications");
  await page.getByRole("button", { name: /mark all read/i }).click();

  await expect(page.getByLabel(/unread notifications/i)).toHaveCount(0, {
    timeout: 15_000,
  });
});

test("a reply notifies the comment author", async ({ page }) => {
  // Author publishes; user B comments; user C replies to B.
  const author = freshUser();
  await registerAndLogin(page, author);
  const url = await publishScenario(page, "Reply Notify Scenario");

  await page.context().clearCookies();
  const commenter = freshUser();
  await registerAndLogin(page, commenter);
  await page.goto(url);
  await page.getByLabel("Add a comment").fill("First thoughts.");
  await page.getByRole("button", { name: /^post$/i }).click();
  await expect(page.getByText("First thoughts.")).toBeVisible({ timeout: 15_000 });

  await page.context().clearCookies();
  await registerAndLogin(page, freshUser());
  await page.goto(url);
  // "Reply" opens the composer; "Post reply" submits it — distinct
  // names so the two cannot be confused.
  await page
    .getByRole("button", { name: /^reply$/i })
    .first()
    .click();
  await page
    .getByLabel(new RegExp(`reply to ${commenter.username}`, "i"))
    .fill("Agreed.");
  await page.getByRole("button", { name: /post reply/i }).click();
  await expect(page.getByText("Agreed.")).toBeVisible({ timeout: 15_000 });

  // The original commenter is notified.
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill("#email", commenter.email);
  await page.fill("#password", commenter.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("/", { timeout: 15_000 });

  await page.goto("/notifications");
  await expect(page.getByText(/replied to you/i)).toBeVisible();
});

test("notifications require a session", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/notifications");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fnotifications/);
});
