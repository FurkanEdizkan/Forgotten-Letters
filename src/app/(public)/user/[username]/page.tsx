import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Layers, ScrollText } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth/guards";
import { getProfile } from "@/lib/queries/profile";
import { listScenariosByAuthor } from "@/lib/queries/scenarios";

type Params = { username: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) return { title: "Not found" };
  return {
    title: profile.displayName ?? profile.username,
    description: profile.bio ?? `Scenarios and campaigns by @${profile.username}.`,
  };
}

export default async function ProfilePage({ params }: { params: Promise<Params> }) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) notFound();

  const viewer = await getCurrentUser();
  const isOwner = viewer?.id === profile.userId;

  // Passing the viewer id means the owner sees their own drafts here;
  // everyone else sees published work only.
  const scenarios = await listScenariosByAuthor(username, viewer?.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <header className="flex flex-wrap items-center gap-5 border-b border-border pb-8">
        <Avatar name={profile.displayName ?? profile.username} size="lg" />
        <div className="flex-1">
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-ink">
            {profile.displayName ?? profile.username}
          </h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-wider text-faint">
            @{profile.username} · joined{" "}
            {new Date(profile.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
            })}
          </p>
          {profile.bio && (
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
              {profile.bio}
            </p>
          )}
        </div>
      </header>

      <div className="mt-6 flex flex-wrap gap-6 font-mono text-xs uppercase tracking-wider text-faint">
        <span className="inline-flex items-center gap-1.5">
          <ScrollText className="size-3.5" /> {profile.publishedScenarios} published
          scenarios
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Layers className="size-3.5" /> {profile.publishedCampaigns} published
          campaigns
        </span>
      </div>

      <section className="mt-10">
        <h2 className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-accent">
          {isOwner ? "Your scenarios" : "Scenarios"}
        </h2>

        {scenarios.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            {isOwner
              ? "You have not created any scenarios yet."
              : "No published scenarios yet."}
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {scenarios.map((s) => (
              <Card key={s.id} interactive className="group relative flex flex-col p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {s.gameSystem && <Badge variant="neutral">{s.gameSystem.name}</Badge>}
                  {/* Drafts are only ever returned to the owner. */}
                  {!s.isPublished && <Badge variant="warning">Draft</Badge>}
                </div>

                <h3 className="mt-3 font-display text-base font-semibold leading-tight text-ink transition-colors group-hover:text-primary">
                  <Link
                    href={`/scenarios/${username}/${s.slug}`}
                    className="after:absolute after:inset-0"
                  >
                    {s.title}
                  </Link>
                </h3>

                {s.summary && (
                  <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted">
                    {s.summary}
                  </p>
                )}

                <div className="mt-4 border-t border-border pt-3 font-mono text-[0.6875rem] uppercase tracking-wider text-faint">
                  {s.votes} votes
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
