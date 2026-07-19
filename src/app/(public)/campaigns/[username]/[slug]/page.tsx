import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Layers, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth/guards";
import { getCampaignBySlug } from "@/lib/queries/campaigns";
import { listBattles } from "@/lib/queries/battles";
import { BattleTracker } from "@/components/campaign/BattleTracker";

type Params = { username: string; slug: string };

const NODE_LABELS: Record<string, string> = {
  start: "Start",
  scenario: "Scenario",
  reward: "Reward",
  finale: "Finale",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { username, slug } = await params;
  const campaign = await getCampaignBySlug(username, slug);
  if (!campaign) return { title: "Not found" };
  return { title: campaign.title, description: campaign.summary ?? undefined };
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { username, slug } = await params;
  const viewer = await getCurrentUser();
  const campaign = await getCampaignBySlug(username, slug, viewer?.id);

  if (!campaign) notFound();

  const isOwner = viewer?.id === campaign.authorId;
  const battles = await listBattles(campaign.id);

  // Edges grouped by source, so the graph reads as an outline rather
  // than a flat list. A rendered canvas would need the design bundle.
  const edgesFrom = new Map<string, typeof campaign.graph.edges>();
  for (const edge of campaign.graph.edges) {
    edgesFrom.set(edge.from, [...(edgesFrom.get(edge.from) ?? []), edge]);
  }
  const nodeById = new Map(campaign.graph.nodes.map((n) => [n.id, n]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <header className="border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-2">
          {campaign.gameSystem && (
            <Badge variant="neutral">{campaign.gameSystem.name}</Badge>
          )}
          {!campaign.isPublished && <Badge variant="warning">Draft</Badge>}
        </div>

        <h1 className="mt-3 font-display text-4xl font-bold uppercase tracking-tight text-ink">
          {campaign.title}
        </h1>

        {campaign.summary && (
          <p className="mt-3 text-lg leading-relaxed text-muted">{campaign.summary}</p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs uppercase tracking-wider text-faint">
          {campaign.author && (
            <Link
              href={`/user/${campaign.author.username}`}
              className="hover:text-primary"
            >
              @{campaign.author.username}
            </Link>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Layers className="size-3.5" /> {campaign.scenarioCount} scenarios
          </span>
          {isOwner && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/campaigns/${username}/${slug}/edit`}>
                <Pencil className="size-3.5" /> Edit
              </Link>
            </Button>
          )}
        </div>
      </header>

      <section className="mt-8">
        <h2 className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-accent">
          Scenarios
        </h2>
        {campaign.scenarios.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No scenarios linked to this campaign yet.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {campaign.scenarios.map((s) => (
              <Card key={s.id} className="flex items-center justify-between gap-3 p-4">
                <Link
                  href={`/scenarios/${username}/${s.slug}`}
                  className="font-display text-base text-ink hover:text-primary"
                >
                  {s.title}
                </Link>
                {!s.isPublished && <Badge variant="warning">Draft</Badge>}
              </Card>
            ))}
          </div>
        )}
      </section>

      <BattleTracker
        campaignId={campaign.id}
        battles={battles}
        scenarios={campaign.scenarios.map((s) => ({ id: s.id, title: s.title }))}
        isOwner={isOwner}
      />

      {campaign.graph.nodes.length > 0 && (
        <section className="mt-8">
          <h2 className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-accent">
            Campaign path
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {campaign.graph.nodes.map((node) => {
              const outgoing = edgesFrom.get(node.id) ?? [];
              return (
                <Card key={node.id} className="p-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">
                      {NODE_LABELS[node.type] ?? node.type}
                    </Badge>
                    <span className="font-display text-base text-ink">
                      {node.label}
                    </span>
                  </div>
                  {node.notes && (
                    <p className="mt-2 text-sm text-muted">{node.notes}</p>
                  )}
                  {outgoing.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-1 border-t border-border pt-2">
                      {outgoing.map((edge) => (
                        <li
                          key={edge.id}
                          className="font-mono text-xs uppercase tracking-wider text-faint"
                        >
                          {edge.label} → {nodeById.get(edge.to)?.label ?? edge.to}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
