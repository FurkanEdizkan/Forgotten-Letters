"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Hook up to Sentry / Vercel error tracking in Phase 8.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <p className="font-mono text-sm uppercase tracking-[0.3em] text-danger">
        Line down
      </p>
      <h1 className="mt-4 font-display text-5xl font-bold uppercase tracking-tight text-ink">
        Something broke
      </h1>
      <p className="mt-4 text-muted">
        An unexpected error interrupted the transmission. Try again, or fall back
        to base.
      </p>
      <div className="mt-8 flex gap-3">
        <Button onClick={reset}>Retry</Button>
        <Button variant="outline" asChild>
          <Link href="/">Return to base</Link>
        </Button>
      </div>
    </div>
  );
}
