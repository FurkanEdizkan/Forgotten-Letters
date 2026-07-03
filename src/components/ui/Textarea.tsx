import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-24 w-full rounded-[var(--radius-md)] border border-border-strong bg-bg px-3 py-2 text-sm text-ink",
        "placeholder:text-faint",
        "transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out-quart)]",
        "focus:border-primary focus:outline-none focus:shadow-[0_0_0_3px_var(--color-primary-soft)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";
