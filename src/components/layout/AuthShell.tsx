import Link from "next/link";
import { Crosshair } from "lucide-react";

/**
 * Framed shell for auth routes: a tactical dossier panel centered on the field.
 * Presentational only — forms wire to Supabase server actions later.
 */
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="rounded-[var(--radius-lg)] border border-border bg-surface">
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-[var(--radius-sm)] border border-primary/40 bg-primary-soft text-primary">
              <Crosshair className="size-4" strokeWidth={2.25} />
            </span>
            <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-faint">
              {eyebrow}
            </span>
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold uppercase tracking-tight text-ink">
            {title}
          </h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="px-6 py-6">{children}</div>
      </div>
      {footer && <p className="mt-6 text-center text-sm text-muted">{footer}</p>}
      <p className="mt-4 text-center">
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-wider text-faint transition-colors hover:text-muted"
        >
          ← Back to base
        </Link>
      </p>
    </div>
  );
}
