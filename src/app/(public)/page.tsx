import Link from "next/link";
import {
  Map as MapIcon,
  ScrollText,
  Dice5,
  Users,
  ArrowRight,
  Crosshair,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

const CAPABILITIES = [
  {
    icon: MapIcon,
    title: "2D Map Editor",
    body: "Draw deployment zones, drop terrain, and import battlefield imagery on a precise canvas built for tabletop tactics.",
  },
  {
    icon: ScrollText,
    title: "Rich Scenarios",
    body: "Compose stories, victory conditions, and structured sections — every scenario reads like a proper field briefing.",
  },
  {
    icon: Dice5,
    title: "Event Tables",
    body: "Build roll-driven event tables that render as clean, scannable instrument data alongside the map.",
  },
  {
    icon: Users,
    title: "Community Repository",
    body: "Publish, duplicate, vote, and favorite. The best scenarios rise through use, not through hype.",
  },
];

const STEPS = [
  { n: "01", label: "Draft the map", detail: "Terrain, zones, objectives." },
  { n: "02", label: "Write the briefing", detail: "Story, sections, event tables." },
  { n: "03", label: "Publish & deploy", detail: "Share it with the front." },
];

export default function HomePage() {
  return (
    <>
      {/* Hero — the war room */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 md:py-28 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <Badge variant="accent">
              <Crosshair className="size-3" /> Trench Crusade · v1
            </Badge>
            <h1 className="mt-5 font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight text-ink sm:text-6xl">
              Forge the battlefield.
              <span className="block text-primary">Share the war.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              A community-driven scenario repository for grimdark wargaming.
              Build maps, write campaigns, and deploy them to a front of players
              who&apos;ll test them across the table.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link href="/register">
                  Enlist now <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/scenarios">Browse scenarios</Link>
              </Button>
            </div>
          </div>

          {/* Tactical readout panel — signature, not a stat template */}
          <Card className="relative overflow-hidden bg-elevated/60 p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5 font-mono text-[0.6875rem] uppercase tracking-wider text-faint">
              <span>SECTOR // MAP_EDITOR</span>
              <span className="text-primary">● LIVE</span>
            </div>
            <div className="relative aspect-[4/3] p-4">
              <div className="absolute inset-4 rounded-[var(--radius-md)] border border-dashed border-border-strong bg-bg [background-image:radial-gradient(oklch(0.65_0.16_250/0.12)_1px,transparent_1px)] [background-size:20px_20px]" />
              <div className="absolute left-8 top-10 h-16 w-24 rounded-[var(--radius-sm)] border border-primary/50 bg-primary-soft/40" />
              <div className="absolute right-10 top-16 h-12 w-12 rounded-full border border-accent/50 bg-accent-soft/40" />
              <div className="absolute bottom-10 left-16 h-10 w-32 -rotate-6 rounded-[var(--radius-sm)] border border-border-strong bg-surface" />
              <span className="absolute left-9 top-11 font-mono text-[0.625rem] uppercase text-primary">
                Zone P1
              </span>
              <span className="absolute bottom-6 right-6 font-mono text-[0.625rem] uppercase tracking-wider text-faint">
                x:412 y:288
              </span>
            </div>
          </Card>
        </div>
      </section>

      {/* Capabilities */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-ink sm:text-4xl">
            Everything a scenario needs
          </h2>
          <p className="mt-4 text-muted">
            Built for the people who make the missions — precise tools, no
            clutter, no toy-store gloss.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {CAPABILITIES.map((cap) => (
            <Card key={cap.title} interactive className="p-6">
              <span className="grid size-11 place-items-center rounded-[var(--radius-md)] border border-primary/30 bg-primary-soft text-primary">
                <cap.icon className="size-5" strokeWidth={2} />
              </span>
              <h3 className="mt-4 font-display text-xl font-semibold text-ink">
                {cap.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {cap.body}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* Ordered flow — numbers earn their place: it IS a sequence */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-ink">
            From blank map to published mission
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.n} className="relative">
                <span className="font-mono text-sm font-semibold text-primary">
                  {step.n}
                </span>
                <div className="mt-2 h-px w-full bg-border-strong" />
                <h3 className="mt-4 font-display text-xl font-semibold uppercase text-ink">
                  {step.label}
                </h3>
                <p className="mt-1.5 text-sm text-muted">{step.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-border bg-elevated px-6 py-16 text-center sm:px-12">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-40 [background-image:linear-gradient(oklch(0.65_0.16_250/0.15)_1px,transparent_1px),linear-gradient(90deg,oklch(0.65_0.16_250/0.15)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
          />
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold uppercase tracking-tight text-ink sm:text-4xl">
            The front is waiting for your scenario
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-muted">
            Create an account, forge your first mission, and put it in front of
            the community.
          </p>
          <div className="mt-8 flex justify-center">
            <Button size="lg" asChild>
              <Link href="/register">
                Enlist now <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
