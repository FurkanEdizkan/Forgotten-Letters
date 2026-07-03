import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Rules",
  description: "Official rules and reference for Trench Crusade.",
};

// Placeholder — real records come from Sanity (Phase 3).
const RULES = [
  { slug: "core-rules", title: "Core Rules", detail: "Movement, actions, combat, and the sequence of play." },
  { slug: "warband-creation", title: "Warband Creation", detail: "Build and equip your warband within the roster limits." },
  { slug: "injuries-and-recovery", title: "Injuries & Recovery", detail: "Post-battle rolls, scars, and the campaign economy." },
  { slug: "terrain-and-cover", title: "Terrain & Cover", detail: "How the battlefield shapes line of sight and protection." },
];

export default function RulesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <header className="flex items-center gap-3 border-b border-border pb-8">
        <span className="grid size-11 place-items-center rounded-[var(--radius-md)] border border-primary/30 bg-primary-soft text-primary">
          <BookOpen className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-ink">
            Rules
          </h1>
          <p className="mt-1 text-muted">Reference for playing Trench Crusade.</p>
        </div>
      </header>

      <ul className="mt-8 flex flex-col gap-2">
        {RULES.map((rule) => (
          <li key={rule.slug}>
            <Card interactive className="relative">
              <Link
                href={`/rules/${rule.slug}`}
                className="flex items-center justify-between gap-4 p-5 after:absolute after:inset-0"
              >
                <div>
                  <h2 className="font-display text-lg font-semibold text-ink">
                    {rule.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted">{rule.detail}</p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-faint" />
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
