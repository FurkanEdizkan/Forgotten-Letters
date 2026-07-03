import { cn } from "@/lib/utils/cn";

/** Initial-based avatar. Swap to next/image once real avatar_url exists. */
export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const initials = name.replace(/[^a-zA-Z0-9]/g, " ").trim().slice(0, 2).toUpperCase();
  const sizes = {
    sm: "size-6 text-[0.625rem]",
    md: "size-9 text-xs",
    lg: "size-12 text-sm",
  };
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full border border-primary/30 bg-primary-soft font-mono font-medium uppercase text-primary",
        sizes[size],
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}
