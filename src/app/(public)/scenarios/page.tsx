import type { Metadata } from "next";
import { Search, SlidersHorizontal } from "lucide-react";
import { ScenarioCard } from "@/components/social/ScenarioCard";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  MOCK_SCENARIOS,
  GAME_SYSTEMS,
  ALL_TAGS,
} from "@/lib/mock/scenarios";

export const metadata: Metadata = {
  title: "Browse Scenarios",
  description: "Browse community-built wargame scenarios for Trench Crusade.",
};

const SORTS = ["Newest", "Top voted", "Most favorited"];

export default function ScenariosPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-ink">
            Scenario Archive
          </h1>
          <p className="mt-2 text-muted">
            {MOCK_SCENARIOS.length} missions on the front. Filter, sort, deploy.
          </p>
        </div>
        <Button asChild>
          <a href="/scenarios/new">Forge a scenario</a>
        </Button>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Filter rail */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:h-fit">
          <div>
            <div className="mb-3 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-faint">
              <SlidersHorizontal className="size-3.5" /> Filters
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <Input
                type="search"
                placeholder="Search missions…"
                className="pl-9"
                aria-label="Search scenarios"
              />
            </div>
          </div>

          <fieldset>
            <Label className="mb-2 block">Game System</Label>
            <div className="flex flex-col gap-1.5">
              {GAME_SYSTEMS.map((sys) => (
                <label
                  key={sys}
                  className="flex cursor-pointer items-center gap-2 text-sm text-muted hover:text-ink"
                >
                  <input
                    type="checkbox"
                    defaultChecked
                    className="size-3.5 accent-[var(--color-primary)]"
                  />
                  {sys}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <Label className="mb-2 block">Player Count</Label>
            <div className="flex items-center gap-2">
              <Input type="number" min={1} defaultValue={2} className="w-16" aria-label="Minimum players" />
              <span className="text-faint">–</span>
              <Input type="number" min={1} defaultValue={4} className="w-16" aria-label="Maximum players" />
            </div>
          </fieldset>

          <fieldset>
            <Label className="mb-2 block">Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TAGS.slice(0, 9).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="cursor-pointer transition-transform hover:-translate-y-px"
                  aria-pressed="false"
                >
                  <Badge variant="neutral">{tag}</Badge>
                </button>
              ))}
            </div>
          </fieldset>
        </aside>

        {/* Results */}
        <section>
          <div className="mb-5 flex items-center justify-between gap-3">
            <p className="font-mono text-xs uppercase tracking-wider text-faint">
              {MOCK_SCENARIOS.length} results
            </p>
            <div className="flex items-center gap-2">
              <Label htmlFor="sort" className="hidden sm:block">
                Sort
              </Label>
              <select
                id="sort"
                className="h-9 rounded-[var(--radius-md)] border border-border-strong bg-bg px-3 text-sm text-ink focus:border-primary focus:outline-none"
              >
                {SORTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {MOCK_SCENARIOS.map((scenario) => (
              <ScenarioCard key={scenario.slug} scenario={scenario} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
