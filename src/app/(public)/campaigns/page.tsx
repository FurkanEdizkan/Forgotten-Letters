import type { Metadata } from "next";
import Link from "next/link";
import { Layers, ScrollText } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Browse Campaigns",
  description: "Multi-scenario campaigns for Trench Crusade.",
};

// Placeholder — real records from Supabase (Phase 4/6).
const CAMPAIGNS = [
  {
    slug: "the-drowned-front",
    title: "The Drowned Front",
    blurb: "A four-scenario campaign following two warbands through a flooded valley offensive.",
    author: "trench_rat",
    scenarios: 4,
    system: "Trench Crusade",
  },
  {
    slug: "vigil-and-ash",
    title: "Vigil and Ash",
    blurb: "Night raids escalate into a full dawn assault. Three linked scenarios with carried-over casualties.",
    author: "sister_agnes",
    scenarios: 3,
    system: "Trench Crusade",
  },
  {
    slug: "the-iron-liturgy",
    title: "The Iron Liturgy",
    blurb: "A defensive campaign holding a chain of confessionals against escalating waves.",
    author: "gunnery_sgt",
    scenarios: 5,
    system: "Trench Crusade",
  },
];

export default function CampaignsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-[var(--radius-md)] border border-primary/30 bg-primary-soft text-primary">
            <Layers className="size-5" />
          </span>
          <div>
            <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-ink">
              Campaigns
            </h1>
            <p className="mt-1 text-muted">Multi-scenario arcs, linked into one story.</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/campaigns/new">Start a campaign</Link>
        </Button>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CAMPAIGNS.map((c) => (
          <Card key={c.slug} interactive className="relative flex flex-col p-5">
            <div className="flex items-center justify-between">
              <Badge variant="neutral">{c.system}</Badge>
              <span className="inline-flex items-center gap-1 font-mono text-[0.6875rem] uppercase tracking-wider text-faint">
                <ScrollText className="size-3" /> {c.scenarios} scenarios
              </span>
            </div>
            <h2 className="mt-3 font-display text-xl font-semibold text-ink">
              <Link href={`/campaigns/${c.slug}`} className="after:absolute after:inset-0">
                {c.title}
              </Link>
            </h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{c.blurb}</p>
            <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
              <Avatar name={c.author} size="sm" />
              <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-faint">
                @{c.author}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
