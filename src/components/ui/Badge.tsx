import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2 py-0.5 font-mono text-[0.6875rem] font-medium uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "bg-primary-soft text-primary border border-primary/30",
        neutral: "bg-elevated text-muted border border-border",
        accent: "bg-accent-soft text-accent border border-accent/30",
        success: "bg-[oklch(0.3_0.06_155)] text-success border border-success/30",
        warning: "bg-[oklch(0.32_0.07_75)] text-warning border border-warning/30",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
