import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { ProfileSettingsForm } from "@/components/settings/ProfileSettingsForm";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Profile settings" };

export default async function ProfileSettingsPage() {
  const user = await requireUser();

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);

  // A session without a profile row means it was deleted mid-session.
  if (!profile) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl text-ink">Profile</h2>
        <p className="mt-1 text-sm text-muted">How you appear to other users.</p>
      </div>
      <ProfileSettingsForm
        initial={{
          username: profile.username,
          displayName: profile.displayName ?? "",
          bio: profile.bio ?? "",
        }}
      />
    </div>
  );
}
