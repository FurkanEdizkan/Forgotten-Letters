/**
 * Scenario read queries.
 *
 * Server-only, not server actions — see the note in queries/social.ts.
 *
 * **Every public listing filters on isPublished.** That predicate is the
 * only thing keeping one user's drafts out of another's browse page, so
 * it belongs in the query, not in a caller that might forget it.
 */
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  eventTables,
  gameSystems,
  profiles,
  scenarios,
  scenarioSections,
} from "@/lib/db/schema";
import { getVoteCounts } from "@/lib/db/votes";

export type ScenarioCard = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  playerCount: number | null;
  estimatedMinutes: number | null;
  tags: string[];
  createdAt: Date;
  author: { username: string; displayName: string | null } | null;
  gameSystem: { slug: string; name: string } | null;
  votes: number;
  /**
   * Always true in public listings (they filter on it). Meaningful only
   * in listScenariosByAuthor, where the owner also sees their drafts.
   */
  isPublished: boolean;
};

export type BrowseFilters = {
  q?: string;
  system?: string;
  players?: number;
  tag?: string;
  page?: number;
};

const PAGE_SIZE = 12;

/** Published scenarios, filtered and paginated. */
export async function browseScenarios(filters: BrowseFilters = {}): Promise<{
  items: ScenarioCard[];
  total: number;
  page: number;
  pageCount: number;
}> {
  const page = Math.max(1, filters.page ?? 1);

  const conditions = [eq(scenarios.isPublished, true)];

  if (filters.q) {
    // ilike rather than a tsvector index: the corpus is small, and a
    // real search index is a Phase 7+ concern once volume justifies it.
    const term = `%${filters.q}%`;
    conditions.push(or(ilike(scenarios.title, term), ilike(scenarios.summary, term))!);
  }
  if (filters.system) {
    conditions.push(eq(gameSystems.slug, filters.system));
  }
  if (filters.players) {
    conditions.push(eq(scenarios.playerCount, filters.players));
  }
  if (filters.tag) {
    // Array containment, so a tag filter matches any position.
    conditions.push(sql`${scenarios.tags} @> ARRAY[${filters.tag}]::text[]`);
  }

  const where = and(...conditions);

  const [{ total }] = await db
    .select({ total: count() })
    .from(scenarios)
    .leftJoin(gameSystems, eq(gameSystems.id, scenarios.gameSystemId))
    .where(where);

  const rows = await db
    .select({
      id: scenarios.id,
      slug: scenarios.slug,
      title: scenarios.title,
      summary: scenarios.summary,
      playerCount: scenarios.playerCount,
      estimatedMinutes: scenarios.estimatedMinutes,
      tags: scenarios.tags,
      createdAt: scenarios.createdAt,
      username: profiles.username,
      displayName: profiles.displayName,
      systemSlug: gameSystems.slug,
      systemName: gameSystems.name,
    })
    .from(scenarios)
    .leftJoin(profiles, eq(profiles.userId, scenarios.authorId))
    .leftJoin(gameSystems, eq(gameSystems.id, scenarios.gameSystemId))
    .where(where)
    .orderBy(desc(scenarios.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  // One batched query rather than one per card.
  const voteCounts = await getVoteCounts(
    "scenario",
    rows.map((r) => r.id),
  );

  return {
    items: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      playerCount: r.playerCount,
      estimatedMinutes: r.estimatedMinutes,
      tags: r.tags,
      createdAt: r.createdAt,
      author: r.username ? { username: r.username, displayName: r.displayName } : null,
      gameSystem: r.systemSlug
        ? { slug: r.systemSlug, name: r.systemName ?? r.systemSlug }
        : null,
      votes: voteCounts.get(r.id) ?? 0,
      isPublished: true,
    })),
    total: Number(total),
    page,
    pageCount: Math.max(1, Math.ceil(Number(total) / PAGE_SIZE)),
  };
}

export type ScenarioDetail = ScenarioCard & {
  authorId: string;
  isPublished: boolean;
  sections: { type: string; heading: string | null; body: string | null }[];
  eventTables: {
    title: string;
    diceNotation: string;
    entries: { min: number; max: number; result: string }[];
  }[];
};

/**
 * One scenario by author + slug.
 *
 * `viewerId` decides whether an unpublished scenario is visible: the
 * author sees their own drafts, nobody else does. Passing undefined
 * (anonymous) means published-only.
 */
export async function getScenarioBySlug(
  username: string,
  slug: string,
  viewerId?: string,
): Promise<ScenarioDetail | null> {
  const [row] = await db
    .select({
      id: scenarios.id,
      slug: scenarios.slug,
      title: scenarios.title,
      summary: scenarios.summary,
      playerCount: scenarios.playerCount,
      estimatedMinutes: scenarios.estimatedMinutes,
      tags: scenarios.tags,
      createdAt: scenarios.createdAt,
      authorId: scenarios.authorId,
      isPublished: scenarios.isPublished,
      username: profiles.username,
      displayName: profiles.displayName,
      systemSlug: gameSystems.slug,
      systemName: gameSystems.name,
    })
    .from(scenarios)
    .leftJoin(profiles, eq(profiles.userId, scenarios.authorId))
    .leftJoin(gameSystems, eq(gameSystems.id, scenarios.gameSystemId))
    .where(and(eq(scenarios.slug, slug), eq(profiles.username, username)))
    .limit(1);

  if (!row) return null;

  // Drafts are visible only to their author. Returning null rather than
  // throwing means the caller renders a 404, which does not confirm the
  // scenario exists.
  if (!row.isPublished && row.authorId !== viewerId) return null;

  const [sections, tables, voteCounts] = await Promise.all([
    db
      .select()
      .from(scenarioSections)
      .where(eq(scenarioSections.scenarioId, row.id))
      .orderBy(asc(scenarioSections.position)),
    db
      .select()
      .from(eventTables)
      .where(eq(eventTables.scenarioId, row.id))
      .orderBy(asc(eventTables.position)),
    getVoteCounts("scenario", [row.id]),
  ]);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    playerCount: row.playerCount,
    estimatedMinutes: row.estimatedMinutes,
    tags: row.tags,
    createdAt: row.createdAt,
    authorId: row.authorId,
    isPublished: row.isPublished,
    author: row.username
      ? { username: row.username, displayName: row.displayName }
      : null,
    gameSystem: row.systemSlug
      ? { slug: row.systemSlug, name: row.systemName ?? row.systemSlug }
      : null,
    votes: voteCounts.get(row.id) ?? 0,
    sections: sections.map((s) => ({
      type: s.type,
      heading: s.heading,
      body: s.body,
    })),
    eventTables: tables.map((t) => ({
      title: t.title,
      diceNotation: t.diceNotation,
      entries: (t.entries as ScenarioDetail["eventTables"][number]["entries"]) ?? [],
    })),
  };
}

/** Published scenarios by one author, for their profile page. */
export async function listScenariosByAuthor(
  username: string,
  viewerId?: string,
): Promise<ScenarioCard[]> {
  const [profile] = await db
    .select({ userId: profiles.userId, username: profiles.username })
    .from(profiles)
    .where(eq(profiles.username, username))
    .limit(1);

  if (!profile) return [];

  const isOwner = profile.userId === viewerId;
  const conditions = [eq(scenarios.authorId, profile.userId)];
  // Visitors see published work only; the owner sees their drafts too.
  if (!isOwner) conditions.push(eq(scenarios.isPublished, true));

  const rows = await db
    .select({
      id: scenarios.id,
      slug: scenarios.slug,
      title: scenarios.title,
      summary: scenarios.summary,
      playerCount: scenarios.playerCount,
      estimatedMinutes: scenarios.estimatedMinutes,
      tags: scenarios.tags,
      createdAt: scenarios.createdAt,
      isPublished: scenarios.isPublished,
      systemSlug: gameSystems.slug,
      systemName: gameSystems.name,
    })
    .from(scenarios)
    .leftJoin(gameSystems, eq(gameSystems.id, scenarios.gameSystemId))
    .where(and(...conditions))
    .orderBy(desc(scenarios.createdAt))
    .limit(50);

  const voteCounts = await getVoteCounts(
    "scenario",
    rows.map((r) => r.id),
  );

  return rows.map((r) => ({
    ...r,
    author: { username: profile.username, displayName: null },
    gameSystem: r.systemSlug
      ? { slug: r.systemSlug, name: r.systemName ?? r.systemSlug }
      : null,
    votes: voteCounts.get(r.id) ?? 0,
  }));
}

/** Active game systems, for filter dropdowns. */
export async function listGameSystems() {
  return db
    .select({ slug: gameSystems.slug, name: gameSystems.name })
    .from(gameSystems)
    .where(eq(gameSystems.isActive, true))
    .orderBy(asc(gameSystems.name));
}
