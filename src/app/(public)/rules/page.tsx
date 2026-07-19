import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, ChevronRight } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { EditionSelector } from "@/components/content/EditionSelector";
import { getLatestEdition, listRules, listRulesEditions } from "@/lib/content";

export const metadata: Metadata = {
  title: "Rules",
  description: "Authoring reference for Trench Crusade scenarios.",
};

export default async function RulesPage({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string }>;
}) {
  const { edition: requested } = await searchParams;
  const editions = await listRulesEditions();
  const latest = await getLatestEdition();

  // An unknown ?edition= is a 404 rather than a silent fallback, so a
  // stale link does not quietly show different rules than it names.
  const edition = requested ?? latest;
  if (!edition || !editions.includes(edition)) {
    if (requested) notFound();
    return null;
  }

  const rules = await listRules(edition);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-accent">
            Reference
          </p>
          <h1 className="mt-2 font-display text-3xl text-ink">Rules</h1>
          <p className="mt-2 max-w-prose text-sm text-muted">
            Authoring context for scenario writers. This is a community archive — it
            contains no official rules text. Buy the rules from the publisher.
          </p>
        </div>
        <EditionSelector editions={editions} current={edition} />
      </div>

      <div className="flex flex-col gap-3">
        {rules.map((rule) => (
          <Link key={rule.slug} href={`/rules/${edition}/${rule.slug}`}>
            <Card className="flex items-center justify-between gap-4 p-5 transition-colors hover:border-border-strong">
              <div className="flex items-start gap-3">
                <BookOpen className="mt-0.5 size-5 shrink-0 text-accent" />
                <div>
                  <h2 className="font-display text-lg text-ink">{rule.title}</h2>
                  {rule.description && (
                    <p className="mt-1 text-sm text-muted">{rule.description}</p>
                  )}
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-faint" />
            </Card>
          </Link>
        ))}

        {rules.length === 0 && (
          <p className="text-sm text-muted">No rules pages in this edition yet.</p>
        )}
      </div>
    </div>
  );
}
