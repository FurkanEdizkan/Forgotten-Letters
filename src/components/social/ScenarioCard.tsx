import Link from "next/link";
import { ArrowUp, Star, Users, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export interface ScenarioSummary {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  gameSystem: string;
  playerMin: number;
  playerMax: number;
  tags: string[];
  votes: number;
  favorites: number;
  comments: number;
}

/** Scenario browse card — tactical dossier tile. Numeric stats set in mono. */
export function ScenarioCard({ scenario }: { scenario: ScenarioSummary }) {
  return (
    <Card interactive className="group relative flex flex-col overflow-hidden">
      {/* Map preview strip — placeholder grid until real map thumbnails exist */}
      <div className="relative aspect-[16/9] border-b border-border bg-bg [background-image:radial-gradient(oklch(0.65_0.16_250/0.1)_1px,transparent_1px)] [background-size:16px_16px]">
        <Badge variant="neutral" className="absolute left-3 top-3">
          {scenario.gameSystem}
        </Badge>
        <span className="absolute bottom-3 right-3 font-mono text-[0.625rem] uppercase tracking-wider text-faint">
          <Users className="mr-1 inline size-3" />
          {scenario.playerMin}–{scenario.playerMax}p
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg font-semibold leading-tight text-ink transition-colors group-hover:text-primary">
          <Link href={`/scenarios/${scenario.slug}`} className="after:absolute after:inset-0">
            {scenario.title}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted">
          {scenario.excerpt}
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {scenario.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="neutral">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-faint">
            @{scenario.author}
          </span>
          <div className="flex items-center gap-3 font-mono text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <ArrowUp className="size-3.5 text-primary" />
              {scenario.votes}
            </span>
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5" />
              {scenario.favorites}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3.5" />
              {scenario.comments}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
