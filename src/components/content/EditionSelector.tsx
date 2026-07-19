import Link from "next/link";

import { cn } from "@/lib/utils/cn";

/**
 * Rules edition switcher.
 *
 * Editions come from the directory listing, so adding one is a mkdir —
 * there is no list to keep in sync. Rendered as links rather than a
 * client-side select so it works without JS and each edition is a real,
 * shareable URL.
 */
export function EditionSelector({
  editions,
  current,
  basePath = "/rules",
}: {
  editions: string[];
  current: string;
  basePath?: string;
}) {
  if (editions.length < 2) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[0.625rem] uppercase tracking-wider text-faint">
        Edition
      </span>
      <div className="flex gap-1">
        {editions.map((edition) => {
          const active = edition === current;
          return (
            <Link
              key={edition}
              href={`${basePath}?edition=${edition}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-[var(--radius-sm)] px-2.5 py-1 font-mono text-xs uppercase tracking-wider transition-colors",
                active
                  ? "bg-primary text-primary-ink"
                  : "border border-border text-muted hover:border-border-strong hover:text-ink",
              )}
            >
              {edition}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
