import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium uppercase tracking-wide transition-[background-color,border-color,transform,box-shadow] duration-150 ease-[var(--ease-out-quart)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Blood-red instrument primary. Bone ink on saturated fill.
        primary:
          "bg-primary text-primary-ink hover:bg-primary-hover active:bg-primary-active",
        // Flare red — reserved for destructive intent.
        danger:
          "bg-danger text-ink hover:bg-danger/90 active:bg-danger/80",
        // Flat-field tonal step, not a shadow.
        secondary:
          "bg-elevated text-ink border border-border-strong hover:bg-border hover:border-primary/60",
        outline:
          "border border-border-strong text-ink hover:border-primary hover:text-primary bg-transparent",
        ghost: "text-muted hover:text-ink hover:bg-surface bg-transparent",
        link: "text-primary hover:text-primary-hover underline-offset-4 hover:underline normal-case tracking-normal",
      },
      size: {
        sm: "h-8 rounded-[var(--radius-sm)] px-3 text-xs",
        md: "h-10 rounded-[var(--radius-md)] px-5 text-sm",
        lg: "h-12 rounded-[var(--radius-md)] px-7 text-base",
        icon: "size-10 rounded-[var(--radius-md)]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
