import { cn } from "@/lib/utils/cn";

/** Tonal-pulse placeholder. Uses surface tokens, never a bright shimmer. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[var(--radius-sm)] bg-elevated",
        className,
      )}
      {...props}
    />
  );
}
