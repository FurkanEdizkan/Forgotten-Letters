/**
 * Scenario CRUD integration tests.
 *
 * Exercises the database layer directly rather than the server actions,
 * because the actions call requireUser() which needs a request context.
 * The authorization logic they rely on — per-author slug uniqueness,
 * cascade deletes, ownership scoping — is what is tested here.
 *
 * Runs against the real compose Postgres.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

const { db } = await import("@/lib/db/client");
const {
  entitlements,
  eventTables,
  gameSystems,
  profiles,
  scenarios,
  scenarioSections,
  users,
} = await import("@/lib/db/schema");

const createdUserIds: string[] = [];
let systemId: string;

async function makeUser() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const [user] = await db
    .insert(users)
    .values({ email: `crud${stamp}@test.local` })
    .returning();
  await db
    .insert(profiles)
    .values({ userId: user.id, username: `crud${stamp}`.slice(0, 24) });
  await db.insert(entitlements).values({ userId: user.id });
  createdUserIds.push(user.id);
  return user.id;
}

async function makeScenario(authorId: string, overrides: Record<string, unknown> = {}) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const [scenario] = await db
    .insert(scenarios)
    .values({
      authorId,
      gameSystemId: systemId,
      slug: `s-${stamp}`,
      title: "Test scenario",
      ...overrides,
    })
    .returning();
  return scenario;
}

beforeAll(async () => {
  const [system] = await db
    .select()
    .from(gameSystems)
    .where(eq(gameSystems.slug, "trench-crusade"))
    .limit(1);
  if (!system) throw new Error("Run `npm run db:seed` before the integration tests.");
  systemId = system.id;
});

afterAll(async () => {
  for (const id of createdUserIds) {
    await db.delete(users).where(eq(users.id, id));
  }
});

describe("scenario ownership", () => {
  it("scopes deletes by author", async () => {
    const owner = await makeUser();
    const attacker = await makeUser();
    const scenario = await makeScenario(owner);

    // The attacker's delete matches no row rather than removing it.
    const [deleted] = await db
      .delete(scenarios)
      .where(and(eq(scenarios.id, scenario.id), eq(scenarios.authorId, attacker)))
      .returning();
    expect(deleted).toBeUndefined();

    const [still] = await db
      .select()
      .from(scenarios)
      .where(eq(scenarios.id, scenario.id));
    expect(still).toBeTruthy();
  });

  it("scopes publish toggles by author", async () => {
    const owner = await makeUser();
    const attacker = await makeUser();
    const scenario = await makeScenario(owner, { isPublished: false });

    const [updated] = await db
      .update(scenarios)
      .set({ isPublished: true })
      .where(and(eq(scenarios.id, scenario.id), eq(scenarios.authorId, attacker)))
      .returning();
    expect(updated).toBeUndefined();

    const [check] = await db
      .select({ p: scenarios.isPublished })
      .from(scenarios)
      .where(eq(scenarios.id, scenario.id));
    expect(check.p).toBe(false);
  });
});

describe("slug uniqueness", () => {
  it("rejects a duplicate slug for the same author", async () => {
    const author = await makeUser();
    await makeScenario(author, { slug: "the-long-retreat" });

    await expect(makeScenario(author, { slug: "the-long-retreat" })).rejects.toThrow();
  });

  it("allows the same slug for different authors", async () => {
    // Slugs are unique per author, not globally, so two users can both
    // publish "the-long-retreat".
    const a = await makeUser();
    const b = await makeUser();
    await makeScenario(a, { slug: "shared-slug-name" });
    await expect(makeScenario(b, { slug: "shared-slug-name" })).resolves.toBeTruthy();
  });
});

describe("cascade deletes", () => {
  it("removes sections and event tables with the scenario", async () => {
    const author = await makeUser();
    const scenario = await makeScenario(author);

    await db.insert(scenarioSections).values({
      scenarioId: scenario.id,
      type: "narrative",
      body: "<p>text</p>",
      position: 0,
    });
    await db.insert(eventTables).values({
      scenarioId: scenario.id,
      title: "Weather",
      diceNotation: "d6",
      position: 0,
    });

    await db.delete(scenarios).where(eq(scenarios.id, scenario.id));

    // Orphaned children would accumulate invisibly.
    expect(
      await db
        .select()
        .from(scenarioSections)
        .where(eq(scenarioSections.scenarioId, scenario.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(eventTables)
        .where(eq(eventTables.scenarioId, scenario.id)),
    ).toHaveLength(0);
  });

  it("removes a user's scenarios when the user is deleted", async () => {
    const author = await makeUser();
    const scenario = await makeScenario(author);

    await db.delete(users).where(eq(users.id, author));

    expect(
      await db.select().from(scenarios).where(eq(scenarios.id, scenario.id)),
    ).toHaveLength(0);
  });
});

describe("campaign linkage", () => {
  it("keeps scenarios when their campaign is deleted", async () => {
    const { campaigns } = await import("@/lib/db/schema");
    const author = await makeUser();

    const [campaign] = await db
      .insert(campaigns)
      .values({
        authorId: author,
        gameSystemId: systemId,
        slug: `c-${Date.now()}`,
        title: "A campaign",
      })
      .returning();

    const scenario = await makeScenario(author, { campaignId: campaign.id });

    await db.delete(campaigns).where(eq(campaigns.id, campaign.id));

    // set null, not cascade: deleting a campaign must not destroy
    // scenarios the author may still want standalone.
    const [survivor] = await db
      .select()
      .from(scenarios)
      .where(eq(scenarios.id, scenario.id));
    expect(survivor).toBeTruthy();
    expect(survivor.campaignId).toBeNull();
  });
});

describe("defaults", () => {
  it("creates scenarios unpublished", async () => {
    // Publishing must be a deliberate act, not the default.
    const author = await makeUser();
    const scenario = await makeScenario(author);
    expect(scenario.isPublished).toBe(false);
  });

  it("defaults tags to an empty array, not null", async () => {
    const author = await makeUser();
    const scenario = await makeScenario(author);
    expect(scenario.tags).toEqual([]);
  });
});
