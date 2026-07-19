/**
 * Browse skeleton.
 *
 * Lives inside the (browse) route group deliberately. A loading.tsx
 * applies to its segment AND every nested route, so at
 * src/app/(public)/scenarios/ it also wrapped
 * /scenarios/[username]/[slug]. That starts streaming, which flushes a
 * 200 before notFound() runs — turning every missing or draft scenario
 * into a soft 404 that search engines index and monitoring cannot see.
 *
 * The route group scopes this skeleton to /scenarios alone without
 * changing the URL.
 */
import { Skeleton } from "@/components/ui/Skeleton";

export default function ScenariosLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="border-b border-border pb-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-3 h-4 w-48" />
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        <div className="hidden flex-col gap-4 lg:flex">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface"
            >
              <Skeleton className="aspect-[16/9] w-full rounded-none" />
              <div className="flex flex-col gap-3 p-5">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
