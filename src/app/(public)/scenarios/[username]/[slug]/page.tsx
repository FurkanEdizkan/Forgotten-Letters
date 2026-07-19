import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUp, Clock, Dice5, Pencil, Users } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth/guards";
import { getScenarioBySlug } from "@/lib/queries/scenarios";

type Params = { username: string; slug: string };

const SECTION_LABELS: Record<string, string> = {
  narrative: "Narrative",
  objectives: "Objectives",
  deployment: "Deployment",
  special_rules: "Special rules",
  victory_conditions: "Victory conditions",
  event_table: "Event table",
  aftermath: "Aftermath",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { username, slug } = await params;
  // No viewer here, so drafts stay unlisted in metadata too.
  const scenario = await getScenarioBySlug(username, slug);
  if (!scenario) return { title: "Not found" };
  return {
    title: scenario.title,
    description: scenario.summary ?? undefined,
  };
}

export default async function ScenarioDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { username, slug } = await params;
  const viewer = await getCurrentUser();
  const scenario = await getScenarioBySlug(username, slug, viewer?.id);

  // Covers both "does not exist" and "someone else's draft" — the query
  // returns null for each, so the URL never confirms a draft exists.
  if (!scenario) notFound();

  const isOwner = viewer?.id === scenario.authorId;

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <header className="border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-2">
          {scenario.gameSystem && (
            <Badge variant="neutral">{scenario.gameSystem.name}</Badge>
          )}
          {!scenario.isPublished && <Badge variant="warning">Draft</Badge>}
        </div>

        <h1 className="mt-3 font-display text-4xl font-bold uppercase tracking-tight text-ink">
          {scenario.title}
        </h1>

        {scenario.summary && (
          <p className="mt-3 text-lg leading-relaxed text-muted">{scenario.summary}</p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs uppercase tracking-wider text-faint">
          {scenario.author && (
            <Link
              href={`/user/${scenario.author.username}`}
              className="hover:text-primary"
            >
              @{scenario.author.username}
            </Link>
          )}
          {scenario.playerCount && (
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" /> {scenario.playerCount}p
            </span>
          )}
          {scenario.estimatedMinutes && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" /> {scenario.estimatedMinutes} min
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <ArrowUp className="size-3.5 text-primary" /> {scenario.votes}
          </span>
          {isOwner && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/scenarios/${username}/${slug}/edit`}>
                <Pencil className="size-3.5" /> Edit
              </Link>
            </Button>
          )}
        </div>

        {scenario.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {scenario.tags.map((tag) => (
              <Badge key={tag} variant="neutral">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </header>

      {scenario.sections.map((section, i) => (
        <section key={i} className="mt-8">
          <h2 className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-accent">
            {SECTION_LABELS[section.type] ?? section.type}
          </h2>
          {section.heading && (
            <h3 className="mt-1 font-display text-xl text-ink">{section.heading}</h3>
          )}
          {section.body && (
            // Sanitized on write in the scenario action, never at render.
            <div
              className="mt-3 leading-relaxed text-muted [&_p]:mb-3 [&_strong]:text-ink"
              dangerouslySetInnerHTML={{ __html: section.body }}
            />
          )}
        </section>
      ))}

      {scenario.eventTables.map((table, i) => (
        <section key={i} className="mt-8">
          <h2 className="flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-[0.2em] text-accent">
            <Dice5 className="size-3.5" /> {table.title} · {table.diceNotation}
          </h2>
          <Card className="mt-3 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-elevated">
                  <th className="px-3 py-2 text-left font-mono text-xs uppercase tracking-wider text-muted">
                    Roll
                  </th>
                  <th className="px-3 py-2 text-left font-mono text-xs uppercase tracking-wider text-muted">
                    Result
                  </th>
                </tr>
              </thead>
              <tbody>
                {table.entries.map((entry, k) => (
                  <tr key={k} className="border-b border-border last:border-0">
                    <td className="w-20 px-3 py-2 font-mono text-muted">
                      {entry.min === entry.max
                        ? entry.min
                        : `${entry.min}–${entry.max}`}
                    </td>
                    <td className="px-3 py-2 text-muted">{entry.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      ))}

      {scenario.sections.length === 0 && scenario.eventTables.length === 0 && (
        <p className="mt-8 text-sm text-muted">This scenario has no content yet.</p>
      )}
    </article>
  );
}
