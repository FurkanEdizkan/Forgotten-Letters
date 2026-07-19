"use client";

import { Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/Button";

/**
 * Google OAuth sign-in.
 *
 * The Google provider is only registered when AUTH_GOOGLE_ID/SECRET are
 * set, so clicking this without them yields an Auth.js error page. Local
 * development normally uses email + password instead.
 *
 * The Suspense boundary lives here rather than at each call site:
 * useSearchParams opts the subtree into client rendering, and without a
 * boundary `next build` fails prerendering every page that mounts this.
 */
export function GoogleButton(props: { label?: string }) {
  return (
    <Suspense fallback={<GoogleButtonFrame label={props.label} disabled />}>
      <GoogleButtonInner {...props} />
    </Suspense>
  );
}

function GoogleButtonInner({ label }: { label?: string }) {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";
  return (
    <GoogleButtonFrame
      label={label}
      onClick={() => signIn("google", { callbackUrl })}
    />
  );
}

function GoogleButtonFrame({
  label = "Continue with Google",
  onClick,
  disabled,
}: {
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="secondary"
      size="lg"
      className="w-full normal-case tracking-normal"
      type="button"
      onClick={onClick}
      disabled={disabled}
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
