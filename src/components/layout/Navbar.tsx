"use client";

import * as React from "react";
import { UserMenu, type NavUser } from "@/components/layout/UserMenu";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

const NAV_LINKS = [
  { href: "/scenarios", label: "Browse" },
  { href: "/official", label: "Official" },
  { href: "/rules", label: "Rules" },
];

export function Navbar({ user }: { user: NavUser | null }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  // Close the mobile sheet on route change.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5"
          aria-label="Forgotten Letters home"
        >
          <span className="grid size-8 place-items-center rounded-[var(--radius-sm)] border border-primary/40 bg-primary-soft text-primary transition-colors group-hover:border-primary">
            <Crosshair className="size-4" strokeWidth={2.25} />
          </span>
          <span className="font-display text-lg font-semibold uppercase tracking-tight text-ink">
            Forgotten Letters
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-[var(--radius-sm)] px-3 py-2 font-mono text-xs font-medium uppercase tracking-wider transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted hover:text-ink hover:bg-surface",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <UserMenu user={user} />
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button variant="primary" size="sm" asChild>
                <Link href="/register">Enlist</Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="grid size-10 place-items-center rounded-[var(--radius-sm)] text-muted hover:text-ink md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-surface md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-[var(--radius-sm)] px-3 py-2.5 font-mono text-sm uppercase tracking-wider text-muted hover:bg-elevated hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2 border-t border-border pt-3">
              {user ? (
                <UserMenu user={user} className="flex-1" />
              ) : (
                <>
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link href="/login">Log in</Link>
                  </Button>
                  <Button variant="primary" size="sm" className="flex-1" asChild>
                    <Link href="/register">Enlist</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
