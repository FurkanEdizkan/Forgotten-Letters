/**
 * Phase 3 — MDX content and rules versioning.
 *
 * The verification that matters here is that the edition selector
 * actually renders a different edition, rather than looking like it does.
 */
import { expect, test } from "@playwright/test";

test("rules index lists the latest edition by default", async ({ page }) => {
  await page.goto("/rules");
  await expect(page.getByRole("heading", { name: "Rules", level: 1 })).toBeVisible();
  // v2 sorts last, so it is the default.
  await expect(page.getByRole("link", { name: "v2" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("switching edition renders that edition's content", async ({ page }) => {
  // v1 has three rules pages, v2 has two — a real content difference,
  // not just a changed label.
  await page.goto("/rules?edition=v1");
  await expect(
    page.getByRole("heading", { name: "Injuries & Recovery" }),
  ).toBeVisible();

  await page.goto("/rules?edition=v2");
  await expect(page.getByRole("heading", { name: "Injuries & Recovery" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("heading", { name: "Core Rules" })).toBeVisible();
});

test("each edition serves its own copy of a shared slug", async ({ page }) => {
  await page.goto("/rules/v1/core-rules");
  await expect(page.getByText("Edition v1")).toBeVisible();
  await expect(page.getByText(/what changed in this edition/i)).toHaveCount(0);

  await page.goto("/rules/v2/core-rules");
  await expect(page.getByText("Edition v2")).toBeVisible();
  // v2-only section — proves the right file was read.
  await expect(
    page.getByRole("heading", { name: /what changed in this edition/i }),
  ).toBeVisible();
});

test("an unknown edition 404s rather than silently falling back", async ({ page }) => {
  // Falling back would show different rules than the URL claims.
  const res = await page.goto("/rules?edition=v99");
  expect(res?.status()).toBe(404);
});

test("a traversal attempt in the slug does not escape the content root", async ({
  page,
}) => {
  const res = await page.goto("/rules/v1/..%2F..%2F..%2Fpackage");
  expect(res?.status()).toBe(404);
});

test("markdown renders as real HTML, not escaped text", async ({ page }) => {
  await page.goto("/rules/v1/core-rules");
  // The table comes from remark-gfm; if MDX failed the page would show
  // pipe characters instead.
  await expect(page.locator("table")).toBeVisible();
  await expect(page.locator("blockquote")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
});

test("official scenarios render", async ({ page }) => {
  await page.goto("/official");
  await page.getByRole("link", { name: /the mud and the hymn/i }).click();
  await expect(
    page.getByRole("heading", { name: /the mud and the hymn/i }),
  ).toBeVisible();
  await expect(page.locator("table")).toBeVisible();
});

test("legal and faq pages render", async ({ page }) => {
  for (const path of ["/legal/terms", "/legal/privacy", "/faq"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});

test("content states plainly that it is unofficial", async ({ page }) => {
  // This is a fan project hosting community content; the disclaimer is
  // a legal requirement, not decoration.
  await page.goto("/faq");
  await expect(page.getByText(/not affiliated/i).first()).toBeVisible();
  await expect(page.getByText(/community-authored/i).first()).toBeVisible();
});
