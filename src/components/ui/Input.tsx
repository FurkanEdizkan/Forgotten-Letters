import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-[var(--radius-md)] border border-border-strong bg-bg px-3 text-sm text-ink",
        "placeholder:text-faint",
        "transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out-quart)]",
        "focus:border-primary focus:outline-none focus:shadow-[0_0_0_3px_var(--color-primary-soft)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:shadow-[0_0_0_3px_var(--color-accent-soft)]",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";
