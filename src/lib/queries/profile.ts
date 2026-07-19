/**
 * Profile read queries. Server-only, not server actions.
 */
import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { campaigns, profiles, scenarios } from "@/lib/db/schema";

export type PublicProfile = {
  userId: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarKey: string | null;
  createdAt: Date;
  publishedScenarios: number;
  publishedCampaigns: number;
};

/** Username for a user id, or null if the profile row is gone. */
export async function getUsernameForUser(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ username: profiles.username })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return row?.username ?? null;
}

/** Public profile by username, with published counts. */
export async function getProfile(username: string): Promise<PublicProfile | null> {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.username, username))
    .limit(1);

  if (!profile) return null;

  // Counts are of published work only — a visitor must not be able to
  // infer how many drafts someone is sitting on.
  const [[scenarioCount], [campaignCount]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(scenarios)
      .where(
        sql`${scenarios.authorId} = ${profile.userId} and ${scenarios.isPublished} = true`,
      ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(campaigns)
      .where(
        sql`${campaigns.authorId} = ${profile.userId} and ${campaigns.isPublished} = true`,
      ),
  ]);

  return {
    userId: profile.userId,
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarKey: profile.avatarKey,
    createdAt: profile.createdAt,
    publishedScenarios: Number(scenarioCount?.n ?? 0),
    publishedCampaigns: Number(campaignCount?.n ?? 0),
  };
}
