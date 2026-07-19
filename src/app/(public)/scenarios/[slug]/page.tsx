import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUp, Star, MessageSquare, Share2, Copy, Users, Dice5 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { MOCK_SCENARIOS } from "@/lib/mock/scenarios";

// Placeholder narrative — real content comes from Supabase (Phase 4).
const STORY =
  "Rain has not stopped for three days. The chapel at the center of the valley — once a place of quiet worship — now stands half-submerged, its bell tower the only dry ground for a hundred yards. Both warbands have received the same orders: take the chapel, hold the relic within, and deny the enemy the blessing it confers. What follows is not a battle so much as a drowning.";

const SECTIONS = [
  {
    type: "Objective",
    title: "Primary Objective",
    body: 'Control the chapel altar at the end of round 6. A model must be within 2" of the altar and unengaged to claim control.',
  },
  {
    type: "Deployment",
    title: "Deployment",
    body: "Each player deploys within their marked zone (see map). Rising water removes one row of terrain from the board edge each round.",
  },
  {
    type: "Victory",
    title: "Victory Conditions",
    body: 'The player controlling the altar at the end of round 6 wins. If neither controls it, the player with the most models within 6" of the chapel wins.',
  },
];

const EVENT_TABLE = {
  title: "The Rising Water (roll d6 at the start of each round)",
  entries: [
    {
      roll: "1",
      effect: "Downpour",
      detail: "All ranged attacks −1 to hit this round.",
    },
    {
      roll: "2–3",
      effect: "Steady rain",
      detail: "No effect. The water rises one row.",
    },
    {
      roll: "4–5",
      effect: "Flash flood",
      detail: 'Models in the lowest row are swept 2" toward a random board edge.',
    },
    {
      roll: "6",
      effect: "The bell tolls",
      detail:
        'Every model within 6" of the tower must pass a nerve test or fall back 3".',
    },
  ],
};

export function generateStaticParams() {
  return MOCK_SCENARIOS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const scenario = MOCK_SCENARIOS.find((s) => s.slug === slug);
  if (!scenario) return { title: "Scenario not found" };
  return { title: scenario.title, description: scenario.excerpt };
}

export default async function ScenarioDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const scenario = MOCK_SCENARIOS.find((s) => s.slug === slug);
  if (!scenario) notFound();

  return (
    <article className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      {/* Breadcrumb */}
      <nav className="mb-6 font-mono text-xs uppercase tracking-wider text-faint">
        <Link href="/scenarios" className="hover:text-primary">
          Archive
        </Link>{" "}
        / <span className="text-muted">{scenario.title}</span>
      </nav>

      <header className="border-b border-border pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">{scenario.gameSystem}</Badge>
          {scenario.tags.map((t) => (
            <Badge key={t} variant="default">
              {t}
            </Badge>
          ))}
        </div>
        <h1 className="mt-4 font-display text-4xl font-bold uppercase tracking-tight text-ink sm:text-5xl">
          {scenario.title}
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">{scenario.excerpt}</p>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar name={scenario.author} />
            <div className="leading-tight">
              <p className="text-sm text-ink">@{scenario.author}</p>
              <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-faint">
                Author
              </p>
            </div>
            <span className="mx-2 h-8 w-px bg-border" />
            <span className="inline-flex items-center gap-1.5 font-mono text-sm text-muted">
              <Users className="size-4" /> {scenario.playerMin}–{scenario.playerMax}{" "}
              players
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm">
              <ArrowUp className="size-4" /> {scenario.votes}
            </Button>
            <Button variant="secondary" size="sm">
              <Star className="size-4" /> {scenario.favorites}
            </Button>
            <Button variant="outline" size="sm">
              <Copy className="size-4" /> Duplicate
            </Button>
            <Button variant="ghost" size="icon" aria-label="Share">
              <Share2 className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-8">
          {/* Map */}
          <section>
            <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-faint">
              Battlefield
            </h2>
            <Card className="mt-3 overflow-hidden p-0">
              <div className="relative aspect-[16/10] bg-bg [background-image:radial-gradient(oklch(0.65_0.16_250/0.12)_1px,transparent_1px)] [background-size:22px_22px]">
                <div className="absolute left-[12%] top-[18%] h-[22%] w-[26%] rounded-[var(--radius-sm)] border border-primary/50 bg-primary-soft/40" />
                <span className="absolute left-[13%] top-[19%] font-mono text-[0.625rem] uppercase text-primary">
                  Zone P1
                </span>
                <div className="absolute bottom-[18%] right-[12%] h-[22%] w-[26%] rounded-[var(--radius-sm)] border border-accent/50 bg-accent-soft/40" />
                <span className="absolute bottom-[35%] right-[13%] font-mono text-[0.625rem] uppercase text-accent">
                  Zone P2
                </span>
                <div className="absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border-strong bg-surface" />
              </div>
            </Card>
          </section>

          {/* Story */}
          <section>
            <h2 className="font-display text-2xl font-semibold uppercase text-ink">
              Briefing
            </h2>
            <p className="mt-3 max-w-[70ch] leading-relaxed text-muted">{STORY}</p>
          </section>

          {/* Sections */}
          <section className="flex flex-col gap-4">
            {SECTIONS.map((sec) => (
              <Card key={sec.title} className="p-5">
                <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-primary">
                  {sec.type}
                </span>
                <h3 className="mt-1 font-display text-lg font-semibold text-ink">
                  {sec.title}
                </h3>
                <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-muted">
                  {sec.body}
                </p>
              </Card>
            ))}
          </section>

          {/* Event table — data is mono */}
          <section>
            <div className="flex items-center gap-2">
              <Dice5 className="size-4 text-primary" />
              <h2 className="font-display text-2xl font-semibold uppercase text-ink">
                Event Table
              </h2>
            </div>
            <Card className="mt-3 overflow-hidden p-0">
              <p className="border-b border-border px-4 py-3 font-mono text-xs uppercase tracking-wider text-muted">
                {EVENT_TABLE.title}
              </p>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border font-mono text-[0.6875rem] uppercase tracking-wider text-faint">
                    <th className="w-16 px-4 py-2 text-left font-medium">Roll</th>
                    <th className="w-32 px-4 py-2 text-left font-medium">Effect</th>
                    <th className="px-4 py-2 text-left font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {EVENT_TABLE.entries.map((e) => (
                    <tr key={e.roll} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-mono text-primary">{e.roll}</td>
                      <td className="px-4 py-3 font-mono uppercase text-ink">
                        {e.effect}
                      </td>
                      <td className="px-4 py-3 text-muted">{e.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:h-fit">
          <Card className="p-5">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-faint">
              Intel
            </h2>
            <dl className="mt-4 flex flex-col gap-3 text-sm">
              {[
                ["System", scenario.gameSystem],
                ["Players", `${scenario.playerMin}–${scenario.playerMax}`],
                ["Votes", String(scenario.votes)],
                ["Favorites", String(scenario.favorites)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <dt className="font-mono text-xs uppercase tracking-wider text-faint">
                    {k}
                  </dt>
                  <dd className="font-mono text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 text-muted">
              <MessageSquare className="size-4" />
              <span className="font-mono text-xs uppercase tracking-wider">
                {scenario.comments} comments
              </span>
            </div>
            <p className="mt-3 text-sm text-faint">
              Comment threads render here once social features (Phase 6) are wired.
            </p>
          </Card>
        </aside>
      </div>
    </article>
  );
}
