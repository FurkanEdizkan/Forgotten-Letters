/**
 * Draft visibility, end to end.
 *
 * The integration tests cover the query predicates; these cover the
 * rendered result — that a draft 404s for everyone but its author and
 * never reaches the public browse listing.
 */
import { expect, test, type Page } from "@playwright/test";

function freshUser() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    username: `vis${stamp}`.slice(0, 24),
    email: `vis${stamp}@test.local`,
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

/** Create a scenario and return its public URL. */
async function createScenario(page: Page, title: string, summary: string) {
  await page.goto("/scenarios/new");
  await page.fill("#title", title);
  await page.fill("#summary", summary);
  await page.getByRole("tab", { name: /sections/i }).click();
  await page.getByLabel("Section 1 body").fill("The bridge must hold.");
  await page.getByRole("button", { name: /^save$/i }).click();
  await page.waitForURL(/\/edit$/, { timeout: 15_000 });
  return page.url().replace(/\/edit$/, "");
}

test("a draft is readable by its author and nobody else", async ({ page }) => {
  await registerAndLogin(page, freshUser());
  const url = await createScenario(page, "Unpublished Work", "Should stay private.");

  // Author can read their own draft.
  expect((await page.goto(url))?.status()).toBe(200);
  await expect(page.getByText(/^draft$/i)).toBeVisible();

  // Anonymous visitor cannot — 404, not 403, so the URL does not
  // confirm the scenario exists.
  await page.context().clearCookies();
  expect((await page.goto(url))?.status()).toBe(404);

  // A different signed-in user also cannot.
  await registerAndLogin(page, freshUser());
  expect((await page.goto(url))?.status()).toBe(404);
});

test("a draft never appears in the public browse listing", async ({ page }) => {
  await registerAndLogin(page, freshUser());
  await createScenario(page, "Hidden Draft Mission", "Not for the archive.");

  await page.goto("/scenarios?q=Hidden+Draft+Mission");
  await expect(page.getByText("Hidden Draft Mission")).toHaveCount(0);
});

test("publishing makes a scenario publicly readable and listed", async ({ page }) => {
  await registerAndLogin(page, freshUser());
  const url = await createScenario(
    page,
    "Public Field Manual",
    "Anyone can read this.",
  );

  await page.getByRole("button", { name: /publish/i }).click();
  await expect(page.getByText(/^published$/i)).toBeVisible({ timeout: 15_000 });

  await page.context().clearCookies();

  const res = await page.goto(url);
  expect(res?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Public Field Manual" }),
  ).toBeVisible();
  await expect(page.getByText("The bridge must hold.")).toBeVisible();

  await page.goto("/scenarios?q=Public+Field+Manual");
  // .first(): repeated runs accumulate scenarios with this title.
  await expect(page.getByText("Public Field Manual").first()).toBeVisible();
});

test("browse filters live in the URL and are shareable", async ({ page }) => {
  await page.goto("/scenarios?q=Public+Field+Manual");
  // The form reflects the query, so a shared link reproduces the view.
  await expect(page.locator("#q")).toHaveValue("Public Field Manual");
});

test("a non-numeric player filter does not break the page", async ({ page }) => {
  // ?players=abc would become NaN and silently match nothing if the
  // page did not guard it.
  const res = await page.goto("/scenarios?players=abc");
  expect(res?.status()).toBe(200);
});
