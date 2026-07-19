import { Button } from "@/components/ui/Button";

/** Presentational Google OAuth button. Wire onClick to Supabase OAuth later. */
export function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
  return (
    <Button
      variant="secondary"
      size="lg"
      className="w-full normal-case tracking-normal"
      type="button"
    >
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
        <path
          fill="#EA4335"
          d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C17 1.9 14.7 1 12 1 6.5 1 2 5.5 2 12s4.5 11 10 11c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z"
        />
      </svg>
      {label}
    </Button>
  );
}
