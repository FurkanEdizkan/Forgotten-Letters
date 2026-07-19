import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { browseScenarios, listGameSystems } from "@/lib/queries/scenarios";

export const metadata: Metadata = {
  title: "Browse scenarios",
  description: "Browse community-built wargame scenarios for Trench Crusade.",
};

type SearchParams = {
  q?: string;
  system?: string;
  players?: string;
  tag?: string;
  page?: string;
};

export default async function ScenariosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const [{ items, total, page, pageCount }, systems] = await Promise.all([
    browseScenarios({
      q: sp.q,
      system: sp.system,
      // A non-numeric ?players= becomes undefined rather than NaN, which
      // would silently match nothing.
      players: sp.players && /^\d+$/.test(sp.players) ? Number(sp.players) : undefined,
      tag: sp.tag,
      page: sp.page && /^\d+$/.test(sp.page) ? Number(sp.page) : 1,
    }),
    listGameSystems(),
  ]);

  function pageHref(n: number) {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.system) params.set("system", sp.system);
    if (sp.players) params.set("players", sp.players);
    if (sp.tag) params.set("tag", sp.tag);
    if (n > 1) params.set("page", String(n));
    const qs = params.toString();
    return qs ? `/scenarios?${qs}` : "/scenarios";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-ink">
            Scenario archive
          </h1>
          <p className="mt-2 text-muted">
            {total} published {total === 1 ? "mission" : "missions"}. Filter, browse,
            deploy.
          </p>
        </div>
        <Button asChild>
          <Link href="/scenarios/new">
            <Plus className="size-4" /> New scenario
          </Link>
        </Button>
      </header>

      {/* GET form so filters live in the URL and are shareable. */}
      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label
            htmlFor="q"
            className="mb-1.5 block font-mono text-[0.625rem] uppercase tracking-wider text-faint"
          >
            Search
          </label>
          <Input
            id="q"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Title or description"
          />
        </div>

        <div>
          <label
            htmlFor="system"
            className="mb-1.5 block font-mono text-[0.625rem] uppercase tracking-wider text-faint"
          >
            System
          </label>
          <select
            id="system"
            name="system"
            defaultValue={sp.system ?? ""}
            className="h-10 rounded-[var(--radius-md)] border border-border-strong bg-bg px-3 text-sm text-ink focus:border-primary focus:outline-none"
          >
            <option value="">Any</option>
            {systems.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="players"
            className="mb-1.5 block font-mono text-[0.625rem] uppercase tracking-wider text-faint"
          >
            Players
          </label>
          <Input
            id="players"
            name="players"
            type="number"
            min={1}
            max={12}
            defaultValue={sp.players ?? ""}
            className="w-24"
          />
        </div>

        <Button type="submit" variant="secondary">
          <Search className="size-4" /> Filter
        </Button>

        {(sp.q || sp.system || sp.players || sp.tag) && (
          <Button variant="ghost" asChild>
            <Link href="/scenarios">Clear</Link>
          </Button>
        )}
      </form>

      {items.length === 0 ? (
        <p className="mt-12 text-center text-muted">
          No scenarios match. Try widening the filters — or{" "}
          <Link href="/scenarios/new" className="text-primary hover:underline">
            publish the first one
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => (
            <Card key={s.id} interactive className="group relative flex flex-col p-5">
              <div className="flex flex-wrap items-center gap-2">
                {s.gameSystem && <Badge variant="neutral">{s.gameSystem.name}</Badge>}
                {s.playerCount && (
                  <span className="font-mono text-[0.625rem] uppercase tracking-wider text-faint">
                    {s.playerCount}p
                  </span>
                )}
              </div>

              <h2 className="mt-3 font-display text-lg font-semibold leading-tight text-ink transition-colors group-hover:text-primary">
                <Link
                  href={`/scenarios/${s.author?.username}/${s.slug}`}
                  className="after:absolute after:inset-0"
                >
                  {s.title}
                </Link>
              </h2>

              {s.summary && (
                <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted">
                  {s.summary}
                </p>
              )}

              {s.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {s.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="neutral">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 font-mono text-[0.6875rem] uppercase tracking-wider text-faint">
                <span>@{s.author?.username ?? "unknown"}</span>
                <span>{s.votes} votes</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-2">
          {page > 1 && (
            <Button variant="secondary" size="sm" asChild>
              <Link href={pageHref(page - 1)}>Previous</Link>
            </Button>
          )}
          <span className="font-mono text-xs text-faint">
            Page {page} of {pageCount}
          </span>
          {page < pageCount && (
            <Button variant="secondary" size="sm" asChild>
              <Link href={pageHref(page + 1)}>Next</Link>
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}
