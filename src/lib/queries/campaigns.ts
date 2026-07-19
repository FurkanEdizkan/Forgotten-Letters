/**
 * Campaign read queries. Server-only, not server actions.
 *
 * Same visibility rule as scenarios: unpublished campaigns are visible
 * to their author and to nobody else. The predicate lives in the query
 * so a caller cannot forget it.
 */
import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { campaigns, gameSystems, profiles, scenarios } from "@/lib/db/schema";
import { EMPTY_GRAPH, type CampaignGraph } from "@/lib/validations/campaign";

export type CampaignCard = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  isPublished: boolean;
  createdAt: Date;
  author: { username: string } | null;
  gameSystem: { slug: string; name: string } | null;
  scenarioCount: number;
};

export type CampaignDetail = CampaignCard & {
  authorId: string;
  graph: CampaignGraph;
  scenarios: { id: string; slug: string; title: string; isPublished: boolean }[];
};

/** Published campaigns, newest first. */
export async function browseCampaigns(): Promise<CampaignCard[]> {
  const rows = await db
    .select({
      id: campaigns.id,
      slug: campaigns.slug,
      title: campaigns.title,
      summary: campaigns.summary,
      isPublished: campaigns.isPublished,
      createdAt: campaigns.createdAt,
      username: profiles.username,
      systemSlug: gameSystems.slug,
      systemName: gameSystems.name,
    })
    .from(campaigns)
    .leftJoin(profiles, eq(profiles.userId, campaigns.authorId))
    .leftJoin(gameSystems, eq(gameSystems.id, campaigns.gameSystemId))
    .where(eq(campaigns.isPublished, true))
    .orderBy(desc(campaigns.createdAt))
    .limit(50);

  // Counting scenarios per campaign in one pass rather than per card.
  const counts = new Map<string, number>();
  if (rows.length) {
    const scenarioRows = await db
      .select({ campaignId: scenarios.campaignId })
      .from(scenarios)
      .where(eq(scenarios.isPublished, true));
    for (const s of scenarioRows) {
      if (s.campaignId) counts.set(s.campaignId, (counts.get(s.campaignId) ?? 0) + 1);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    isPublished: r.isPublished,
    createdAt: r.createdAt,
    author: r.username ? { username: r.username } : null,
    gameSystem: r.systemSlug
      ? { slug: r.systemSlug, name: r.systemName ?? r.systemSlug }
      : null,
    scenarioCount: counts.get(r.id) ?? 0,
  }));
}

/**
 * One campaign by author + slug.
 *
 * `viewerId` gates draft visibility, and also decides which scenarios
 * are listed: the author sees their unpublished ones, visitors do not.
 */
export async function getCampaignBySlug(
  username: string,
  slug: string,
  viewerId?: string,
): Promise<CampaignDetail | null> {
  const [row] = await db
    .select({
      id: campaigns.id,
      slug: campaigns.slug,
      title: campaigns.title,
      summary: campaigns.summary,
      isPublished: campaigns.isPublished,
      createdAt: campaigns.createdAt,
      authorId: campaigns.authorId,
      graph: campaigns.graph,
      username: profiles.username,
      systemSlug: gameSystems.slug,
      systemName: gameSystems.name,
    })
    .from(campaigns)
    .leftJoin(profiles, eq(profiles.userId, campaigns.authorId))
    .leftJoin(gameSystems, eq(gameSystems.id, campaigns.gameSystemId))
    .where(and(eq(campaigns.slug, slug), eq(profiles.username, username)))
    .limit(1);

  if (!row) return null;
  if (!row.isPublished && row.authorId !== viewerId) return null;

  const isOwner = row.authorId === viewerId;
  const scenarioConditions = [eq(scenarios.campaignId, row.id)];
  if (!isOwner) scenarioConditions.push(eq(scenarios.isPublished, true));

  const linked = await db
    .select({
      id: scenarios.id,
      slug: scenarios.slug,
      title: scenarios.title,
      isPublished: scenarios.isPublished,
    })
    .from(scenarios)
    .where(and(...scenarioConditions))
    .orderBy(asc(scenarios.createdAt));

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    isPublished: row.isPublished,
    createdAt: row.createdAt,
    authorId: row.authorId,
    author: row.username ? { username: row.username } : null,
    gameSystem: row.systemSlug
      ? { slug: row.systemSlug, name: row.systemName ?? row.systemSlug }
      : null,
    scenarioCount: linked.length,
    // Stored graphs predate later schema changes, so fall back rather
    // than trusting the JSONB blindly.
    graph: (row.graph as CampaignGraph | null) ?? EMPTY_GRAPH,
    scenarios: linked,
  };
}

/** Campaigns owned by a user, for their own dashboards and pickers. */
export async function listCampaignsByOwner(userId: string) {
  return db
    .select({
      id: campaigns.id,
      slug: campaigns.slug,
      title: campaigns.title,
      isPublished: campaigns.isPublished,
    })
    .from(campaigns)
    .where(eq(campaigns.authorId, userId))
    .orderBy(desc(campaigns.createdAt))
    .limit(100);
}
