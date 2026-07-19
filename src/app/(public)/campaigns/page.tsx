import type { Metadata } from "next";
import Link from "next/link";
import { Layers, Plus } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { browseCampaigns } from "@/lib/queries/campaigns";

export const metadata: Metadata = {
  title: "Browse campaigns",
  description: "Multi-scenario campaigns for Trench Crusade.",
};

export default async function CampaignsPage() {
  const campaigns = await browseCampaigns();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-ink">
            Campaigns
          </h1>
          <p className="mt-2 text-muted">
            {campaigns.length} published{" "}
            {campaigns.length === 1 ? "campaign" : "campaigns"}. Linked scenarios,
            branching outcomes.
          </p>
        </div>
        <Button asChild>
          <Link href="/campaigns/new">
            <Plus className="size-4" /> New campaign
          </Link>
        </Button>
      </header>

      {campaigns.length === 0 ? (
        <p className="mt-12 text-center text-muted">
          No campaigns yet.{" "}
          <Link href="/campaigns/new" className="text-primary hover:underline">
            Start the first one
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <Card key={c.id} interactive className="group relative flex flex-col p-5">
              <div className="flex flex-wrap items-center gap-2">
                {c.gameSystem && <Badge variant="neutral">{c.gameSystem.name}</Badge>}
                <span className="inline-flex items-center gap-1 font-mono text-[0.625rem] uppercase tracking-wider text-faint">
                  <Layers className="size-3" /> {c.scenarioCount}
                </span>
              </div>

              <h2 className="mt-3 font-display text-lg font-semibold leading-tight text-ink transition-colors group-hover:text-primary">
                <Link
                  href={`/campaigns/${c.author?.username}/${c.slug}`}
                  className="after:absolute after:inset-0"
                >
                  {c.title}
                </Link>
              </h2>

              {c.summary && (
                <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted">
                  {c.summary}
                </p>
              )}

              <div className="mt-4 border-t border-border pt-3 font-mono text-[0.6875rem] uppercase tracking-wider text-faint">
                @{c.author?.username ?? "unknown"}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
