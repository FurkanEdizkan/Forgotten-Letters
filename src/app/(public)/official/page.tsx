import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "Official Content",
  description: "Official, CMS-managed scenarios and campaigns for Trench Crusade.",
};

// Placeholder — real records come from Sanity (Phase 3).
const OFFICIAL = [
  {
    slug: "the-first-crusade",
    title: "The First Crusade",
    blurb: "The canonical opening campaign — four linked scenarios.",
  },
  {
    slug: "siege-of-the-cathedral",
    title: "Siege of the Cathedral",
    blurb: "A large-scale multiplayer siege with official rules.",
  },
  {
    slug: "the-broken-armistice",
    title: "The Broken Armistice",
    blurb: "An introductory duel scenario for new warbands.",
  },
];

export default function OfficialPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <header className="flex items-center gap-3 border-b border-border pb-8">
        <span className="grid size-11 place-items-center rounded-[var(--radius-md)] border border-primary/30 bg-primary-soft text-primary">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-ink">
            Official Content
          </h1>
          <p className="mt-1 text-muted">
            Canonical campaigns and scenarios, curated and CMS-managed.
          </p>
        </div>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {OFFICIAL.map((item) => (
          <Card key={item.slug} interactive className="relative p-5">
            <Badge variant="accent">Official</Badge>
            <h2 className="mt-3 font-display text-lg font-semibold text-ink">
              <Link
                href={`/official/${item.slug}`}
                className="after:absolute after:inset-0"
              >
                {item.title}
              </Link>
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{item.blurb}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
