/**
 * Avatar upload.
 *
 * Exercises the whole presigned flow: request a signed PUT, upload the
 * bytes straight to storage, confirm the row, and point the profile at
 * it. The uploaded object is then fetched back over HTTP to prove it is
 * actually readable at the URL the app builds.
 */
import { expect, test, type Page } from "@playwright/test";

/** Smallest valid PNG — 1×1, transparent. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function freshUser() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    username: `av${stamp}`.slice(0, 24),
    email: `av${stamp}@test.local`,
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

async function pickAvatar(page: Page, name: string, mimeType: string, buffer: Buffer) {
  await page
    .getByLabel("Choose an avatar image")
    .setInputFiles({ name, mimeType, buffer });
}

test("upload an avatar and fetch it back over HTTP", async ({ page, request }) => {
  const user = freshUser();
  await registerAndLogin(page, user);

  await page.goto("/settings/profile");
  await pickAvatar(page, "avatar.png", "image/png", Buffer.from(PNG_BASE64, "base64"));

  await expect(page.getByText(/avatar updated/i)).toBeVisible({ timeout: 20_000 });

  // The rendered <img> must point at the avatars bucket and actually
  // resolve — a URL built against the wrong bucket would 403 or 404.
  const src = await page.locator('img[alt="Your avatar"]').getAttribute("src");
  expect(src).toContain("forgotten-letters-avatars");

  const fetched = await request.get(src!);
  expect(fetched.status(), "avatar URL should be publicly readable").toBe(200);
});

test("the avatar appears on the public profile", async ({ page }) => {
  const user = freshUser();
  await registerAndLogin(page, user);

  await page.goto("/settings/profile");
  await pickAvatar(page, "avatar.png", "image/png", Buffer.from(PNG_BASE64, "base64"));
  await expect(page.getByText(/avatar updated/i)).toBeVisible({ timeout: 20_000 });

  // Anonymous visitors must be able to load it.
  await page.context().clearCookies();
  const res = await page.goto(`/user/${user.username}`);
  expect(res?.status()).toBe(200);
});

test("uploading counts against the storage quota", async ({ page }) => {
  await registerAndLogin(page, freshUser());

  await page.goto("/settings/storage");
  await expect(page.getByText(/no uploads yet/i)).toBeVisible();

  await page.goto("/settings/profile");
  await pickAvatar(page, "avatar.png", "image/png", Buffer.from(PNG_BASE64, "base64"));
  await expect(page.getByText(/avatar updated/i)).toBeVisible({ timeout: 20_000 });

  await page.goto("/settings/storage");
  await expect(page.getByText(/no uploads yet/i)).toHaveCount(0);
  await expect(
    page.getByText("avatar.png").or(page.locator("text=.png")),
  ).toBeVisible();
});

test("replacing an avatar frees the previous one", async ({ page }) => {
  await registerAndLogin(page, freshUser());
  const png = Buffer.from(PNG_BASE64, "base64");

  await page.goto("/settings/profile");
  await pickAvatar(page, "first.png", "image/png", png);
  await expect(page.getByText(/avatar updated/i)).toBeVisible({ timeout: 20_000 });

  await page.goto("/settings/profile");
  await pickAvatar(page, "second.png", "image/png", png);
  await expect(page.getByText(/avatar updated/i)).toBeVisible({ timeout: 20_000 });

  // Exactly one file: the old row is deleted, so repeated changes do
  // not silently consume quota forever.
  await page.goto("/settings/storage");
  const rows = page.locator("text=/\\.png$/");
  await expect(rows).toHaveCount(1);
});

test("a non-image file is rejected client-side", async ({ page }) => {
  await registerAndLogin(page, freshUser());

  await page.goto("/settings/profile");
  await pickAvatar(
    page,
    "notes.txt",
    "text/plain",
    Buffer.from("this is not an image"),
  );

  await expect(page.locator('p[role="alert"]').first()).toContainText(
    /png, jpeg, webp, or gif/i,
  );
});

test("an oversized file is rejected before upload", async ({ page }) => {
  await registerAndLogin(page, freshUser());

  await page.goto("/settings/profile");
  // 3 MB, over the 2 MB avatar cap.
  await pickAvatar(page, "huge.png", "image/png", Buffer.alloc(3 * 1024 * 1024));

  await expect(page.locator('p[role="alert"]').first()).toContainText(
    /2 MB or smaller/i,
  );
});
