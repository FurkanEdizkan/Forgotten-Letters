import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <p className="font-mono text-sm uppercase tracking-[0.3em] text-accent">
        Sector 404
      </p>
      <h1 className="mt-4 font-display text-6xl font-bold uppercase tracking-tight text-ink">
        Off the map
      </h1>
      <p className="mt-4 text-muted">
        This position doesn&apos;t exist — the coordinates lead into no man&apos;s land.
        Fall back to a known sector.
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link href="/">Return to base</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/scenarios">Browse scenarios</Link>
        </Button>
      </div>
    </div>
  );
}
