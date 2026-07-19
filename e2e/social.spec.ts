/**
 * Comments and profiles.
 *
 * The comment body is rendered with dangerouslySetInnerHTML, so the
 * sanitizer is the only thing between a commenter and every reader's
 * browser. One of these tests posts an actual XSS payload.
 */
import { expect, test, type Page } from "@playwright/test";

function freshUser() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    username: `soc${stamp}`.slice(0, 24),
    email: `soc${stamp}@test.local`,
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

/** Publish a scenario and return its public URL. */
async function publishScenario(page: Page, title: string) {
  await page.goto("/scenarios/new");
  await page.fill("#title", title);
  await page.fill("#summary", "For comment tests.");
  await page.getByRole("button", { name: /^save$/i }).click();
  await page.waitForURL(/\/edit$/, { timeout: 15_000 });
  await page.getByRole("button", { name: /publish/i }).click();
  await expect(page.getByText(/^published$/i)).toBeVisible({ timeout: 15_000 });
  return page.url().replace(/\/edit$/, "");
}

test("post a comment and see it appear", async ({ page }) => {
  const user = freshUser();
  await registerAndLogin(page, user);
  const url = await publishScenario(page, "Comment Target One");

  await page.goto(url);
  await page.getByLabel("Add a comment").fill("The ford is the crux of this one.");
  await page.getByRole("button", { name: /^post$/i }).click();

  await expect(page.getByText("The ford is the crux of this one.")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(`@${user.username}`).first()).toBeVisible();
});

test("comments are sanitized, not executed", async ({ page }) => {
  await registerAndLogin(page, freshUser());
  const url = await publishScenario(page, "XSS Target Scenario");

  // Fail loudly if anything actually executes.
  let alertFired = false;
  page.on("dialog", async (d) => {
    alertFired = true;
    await d.dismiss();
  });

  await page.goto(url);
  await page
    .getByLabel("Add a comment")
    .fill('<img src=x onerror="alert(1)">payload text<script>alert(2)</script>');
  await page.getByRole("button", { name: /^post$/i }).click();

  await expect(page.getByText("payload text")).toBeVisible({ timeout: 15_000 });

  expect(alertFired, "sanitizer let script execute").toBe(false);

  // Scoped to the rendered comment body. Asserting on the whole page —
  // or even the whole section — reads Next's dev runtime and the
  // composer textarea, both of which legitimately contain the raw
  // string. The markup must be gone from the stored body, not inert.
  const body = page.getByTestId("comment-body").first();
  await expect(body).toContainText("payload text");
  const commentHtml = await body.innerHTML();
  expect(commentHtml).not.toContain("onerror");
  expect(commentHtml).not.toContain("<script");
  expect(commentHtml).not.toContain("<img");
});

test("only the author can delete their comment", async ({ page }) => {
  const author = freshUser();
  await registerAndLogin(page, author);
  const url = await publishScenario(page, "Delete Target Scenario");

  await page.goto(url);
  await page.getByLabel("Add a comment").fill("Mine to remove.");
  await page.getByRole("button", { name: /^post$/i }).click();
  await expect(page.getByText("Mine to remove.")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /delete/i })).toBeVisible();

  // A different user sees the comment but no delete control.
  await page.context().clearCookies();
  await registerAndLogin(page, freshUser());
  await page.goto(url);
  await expect(page.getByText("Mine to remove.")).toBeVisible();
  await expect(page.getByRole("button", { name: /delete/i })).toHaveCount(0);
});

test("deleting a comment leaves a tombstone", async ({ page }) => {
  await registerAndLogin(page, freshUser());
  const url = await publishScenario(page, "Tombstone Target");

  await page.goto(url);
  await page.getByLabel("Add a comment").fill("Soon to vanish.");
  await page.getByRole("button", { name: /^post$/i }).click();
  await expect(page.getByText("Soon to vanish.")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /delete/i }).click();

  // Soft-deleted so replies keep their thread position.
  await expect(page.getByText(/this comment was deleted/i)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Soon to vanish.")).toHaveCount(0);
});

test("signed-out visitors are prompted to log in instead of commenting", async ({
  page,
}) => {
  await registerAndLogin(page, freshUser());
  const url = await publishScenario(page, "Anon View Scenario");

  await page.context().clearCookies();
  await page.goto(url);

  await expect(page.getByLabel("Add a comment")).toHaveCount(0);
  await expect(page.getByText(/log in/i).first()).toBeVisible();
});

test("profile shows published work and counts", async ({ page }) => {
  const user = freshUser();
  await registerAndLogin(page, user);
  await publishScenario(page, "Profile Listed Scenario");

  await page.goto(`/user/${user.username}`);
  await expect(page.getByRole("heading", { name: user.username })).toBeVisible();
  await expect(page.getByText("Profile Listed Scenario")).toBeVisible();
  await expect(page.getByText(/1 published scenarios/i)).toBeVisible();
});

test("a visitor does not see another user's drafts on their profile", async ({
  page,
}) => {
  const author = freshUser();
  await registerAndLogin(page, author);

  // Draft, deliberately left unpublished.
  await page.goto("/scenarios/new");
  await page.fill("#title", "Profile Hidden Draft");
  await page.getByRole("button", { name: /^save$/i }).click();
  await page.waitForURL(/\/edit$/, { timeout: 15_000 });

  // The owner sees it, labelled.
  await page.goto(`/user/${author.username}`);
  await expect(page.getByText("Profile Hidden Draft")).toBeVisible();
  await expect(page.getByText(/^draft$/i).first()).toBeVisible();

  // A visitor does not.
  await page.context().clearCookies();
  await page.goto(`/user/${author.username}`);
  await expect(page.getByText("Profile Hidden Draft")).toHaveCount(0);
});

test("an unknown profile 404s", async ({ page }) => {
  const res = await page.goto("/user/definitely-not-a-real-user");
  expect(res?.status()).toBe(404);
});
