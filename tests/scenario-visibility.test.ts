/**
 * Draft visibility.
 *
 * This is the check deferred from Phase 2.4 — it needed read paths,
 * which now exist. The rule under test: an unpublished scenario is
 * visible to its author and to nobody else, anywhere.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

const { db } = await import("@/lib/db/client");
const { entitlements, gameSystems, profiles, scenarios, users } =
  await import("@/lib/db/schema");
const { browseScenarios, getScenarioBySlug, listScenariosByAuthor } =
  await import("@/lib/queries/scenarios");

const createdUserIds: string[] = [];
let systemId: string;

async function makeAuthor() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const username = `vis${stamp}`.slice(0, 24);
  const [user] = await db
    .insert(users)
    .values({ email: `${username}@test.local` })
    .returning();
  await db.insert(profiles).values({ userId: user.id, username });
  await db.insert(entitlements).values({ userId: user.id });
  createdUserIds.push(user.id);
  return { userId: user.id, username };
}

async function makeScenario(
  authorId: string,
  isPublished: boolean,
  title = "Visibility Test",
) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const [row] = await db
    .insert(scenarios)
    .values({
      authorId,
      gameSystemId: systemId,
      slug: `vis-${stamp}`,
      title,
      isPublished,
    })
    .returning();
  return row;
}

beforeAll(async () => {
  const [system] = await db
    .select()
    .from(gameSystems)
    .where(eq(gameSystems.slug, "trench-crusade"))
    .limit(1);
  if (!system) throw new Error("Run `npm run db:seed` first.");
  systemId = system.id;
});

afterAll(async () => {
  for (const id of createdUserIds) {
    await db.delete(users).where(eq(users.id, id));
  }
});

describe("browse", () => {
  it("excludes unpublished scenarios", async () => {
    const author = await makeAuthor();
    const draft = await makeScenario(author.userId, false);
    const published = await makeScenario(author.userId, true);

    const { items } = await browseScenarios({ q: "Visibility Test" });
    const ids = items.map((i) => i.id);

    expect(ids).toContain(published.id);
    // A draft in the public browse list would leak unfinished work.
    expect(ids).not.toContain(draft.id);
  });

  it("excludes drafts even for their own author", async () => {
    // Browse is the public listing; the author's drafts belong on their
    // profile and dashboard, not in the shared feed.
    const author = await makeAuthor();
    const draft = await makeScenario(author.userId, false);

    const { items } = await browseScenarios({ q: "Visibility Test" });
    expect(items.map((i) => i.id)).not.toContain(draft.id);
  });
});

describe("getScenarioBySlug", () => {
  it("returns a published scenario to anonymous viewers", async () => {
    const author = await makeAuthor();
    const s = await makeScenario(author.userId, true);

    const found = await getScenarioBySlug(author.username, s.slug);
    expect(found?.id).toBe(s.id);
  });

  it("hides a draft from anonymous viewers", async () => {
    const author = await makeAuthor();
    const s = await makeScenario(author.userId, false);

    expect(await getScenarioBySlug(author.username, s.slug)).toBeNull();
  });

  it("hides a draft from a different signed-in user", async () => {
    const author = await makeAuthor();
    const other = await makeAuthor();
    const s = await makeScenario(author.userId, false);

    expect(await getScenarioBySlug(author.username, s.slug, other.userId)).toBeNull();
  });

  it("shows a draft to its own author", async () => {
    const author = await makeAuthor();
    const s = await makeScenario(author.userId, false);

    const found = await getScenarioBySlug(author.username, s.slug, author.userId);
    expect(found?.id).toBe(s.id);
    expect(found?.isPublished).toBe(false);
  });

  it("does not match a slug under the wrong author", async () => {
    // Slugs are unique per author, so the username is part of identity.
    const author = await makeAuthor();
    const other = await makeAuthor();
    const s = await makeScenario(author.userId, true);

    expect(await getScenarioBySlug(other.username, s.slug)).toBeNull();
  });
});

describe("listScenariosByAuthor", () => {
  it("shows visitors only published work", async () => {
    const author = await makeAuthor();
    const visitor = await makeAuthor();
    const draft = await makeScenario(author.userId, false);
    const published = await makeScenario(author.userId, true);

    const asVisitor = await listScenariosByAuthor(author.username, visitor.userId);
    const ids = asVisitor.map((s) => s.id);
    expect(ids).toContain(published.id);
    expect(ids).not.toContain(draft.id);
  });

  it("shows the owner their drafts too", async () => {
    const author = await makeAuthor();
    const draft = await makeScenario(author.userId, false);
    const published = await makeScenario(author.userId, true);

    const asOwner = await listScenariosByAuthor(author.username, author.userId);
    const ids = asOwner.map((s) => s.id);
    expect(ids).toContain(published.id);
    expect(ids).toContain(draft.id);
  });

  it("returns nothing for an unknown username", async () => {
    expect(await listScenariosByAuthor("nobody-at-all-here")).toEqual([]);
  });
});
