import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { CampaignEditor } from "@/components/campaign/CampaignEditor";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { gameSystems, profiles } from "@/lib/db/schema";

export const metadata: Metadata = { title: "New campaign" };

export default async function NewCampaignPage() {
  const user = await requireUser();

  const [systems, [profile]] = await Promise.all([
    db
      .select({ id: gameSystems.id, name: gameSystems.name })
      .from(gameSystems)
      .where(eq(gameSystems.isActive, true)),
    db
      .select({ username: profiles.username })
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1),
  ]);

  if (systems.length === 0) redirect("/campaigns");
  if (!profile) redirect("/login");

  return <CampaignEditor systems={systems} username={profile.username} />;
}
