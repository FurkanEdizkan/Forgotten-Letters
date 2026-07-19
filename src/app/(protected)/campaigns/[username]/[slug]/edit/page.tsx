import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { CampaignEditor } from "@/components/campaign/CampaignEditor";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { campaigns, gameSystems, profiles } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Edit campaign" };

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const user = await requireUser();
  const { username, slug } = await params;

  // Scoped to the signed-in author and the username in the URL, so
  // another user's campaign is a 404 rather than a 403.
  const rows = await db
    .select()
    .from(campaigns)
    .innerJoin(profiles, eq(profiles.userId, campaigns.authorId))
    .where(
      and(
        eq(campaigns.slug, slug),
        eq(campaigns.authorId, user.id),
        eq(profiles.username, username),
      ),
    )
    .limit(1);

  const campaign = rows[0]?.campaigns;
  if (!campaign) notFound();

  const systems = await db
    .select({ id: gameSystems.id, name: gameSystems.name })
    .from(gameSystems)
    .where(eq(gameSystems.isActive, true));

  return (
    <CampaignEditor
      systems={systems}
      username={username}
      campaign={{
        id: campaign.id,
        title: campaign.title,
        slug: campaign.slug,
        summary: campaign.summary ?? "",
        gameSystemId: campaign.gameSystemId,
        isPublished: campaign.isPublished,
      }}
    />
  );
}
