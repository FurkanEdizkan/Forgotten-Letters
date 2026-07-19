"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";

import { signOutAction } from "@/lib/actions/session";
import { cn } from "@/lib/utils/cn";

export type NavUser = {
  username: string;
  displayName: string | null;
};

/** Signed-in account menu. Rendered only when a session exists. */
export function UserMenu({ user, className }: { user: NavUser; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape — a menu that traps focus or
  // stays open behind a navigation is worse than no menu.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function onSignOut() {
    startTransition(async () => {
      await signOutAction();
      setOpen(false);
      router.push("/");
      router.refresh();
    });
  }

  const label = user.displayName || user.username;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:bg-surface hover:text-ink"
      >
        <User className="size-4" />
        <span className="max-w-[12ch] truncate">{label}</span>
        <ChevronDown
          className={cn("size-3 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-48 overflow-hidden rounded-[var(--radius-sm)] border border-border bg-elevated shadow-lg"
        >
          <Link
            role="menuitem"
            href={`/user/${user.username}`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted hover:bg-surface hover:text-ink"
          >
            <User className="size-4" /> Profile
          </Link>
          <Link
            role="menuitem"
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted hover:bg-surface hover:text-ink"
          >
            <Settings className="size-4" /> Settings
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={onSignOut}
            disabled={pending}
            className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-sm text-muted hover:bg-surface hover:text-primary disabled:opacity-60"
          >
            <LogOut className="size-4" /> {pending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
