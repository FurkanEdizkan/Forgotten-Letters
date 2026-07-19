import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ScrollText } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { listOfficial } from "@/lib/content";

export const metadata: Metadata = {
  title: "Official scenarios",
  description: "Curated scenarios maintained in the repository.",
};

export default async function OfficialPage() {
  const scenarios = await listOfficial();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-accent">
        Curated
      </p>
      <h1 className="mt-2 font-display text-3xl text-ink">Official scenarios</h1>
      <p className="mt-2 max-w-prose text-sm text-muted">
        Scenarios maintained in the repository and reviewed before publication. Edits
        arrive by pull request.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        {scenarios.map((s) => (
          <Link key={s.slug} href={`/official/${s.slug}`}>
            <Card className="flex items-center justify-between gap-4 p-5 transition-colors hover:border-border-strong">
              <div className="flex items-start gap-3">
                <ScrollText className="mt-0.5 size-5 shrink-0 text-accent" />
                <div>
                  <h2 className="font-display text-lg text-ink">{s.title}</h2>
                  {s.description && (
                    <p className="mt-1 text-sm text-muted">{s.description}</p>
                  )}
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-faint" />
            </Card>
          </Link>
        ))}

        {scenarios.length === 0 && (
          <p className="text-sm text-muted">No official scenarios yet.</p>
        )}
      </div>
    </div>
  );
}
