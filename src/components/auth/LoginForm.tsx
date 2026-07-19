"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";

import { loginAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Set by middleware when it bounced an unauthenticated request.
  const callbackUrl = params.get("callbackUrl") ?? "/";

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await loginAction(formData);
      if (result.ok) {
        router.push(callbackUrl);
        // The session cookie is set outside React's data cache; without
        // a refresh the server components still render as signed out.
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      {error && (
        <p
          role="alert"
          className="rounded border border-primary/40 bg-primary-soft px-3 py-2 text-sm text-primary-ink"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="soldier@front.line"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="font-mono text-[0.625rem] uppercase tracking-wider text-faint hover:text-primary"
          >
            Forgot?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="totp">Authentication code</Label>
        <Input
          id="totp"
          name="totp"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Only if two-factor is enabled"
        />
        <p className="text-xs text-faint">
          Leave blank unless you have two-factor authentication turned on. A recovery
          code also works here.
        </p>
      </div>

      <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>
        {pending ? "Signing in…" : "Log in"}
      </Button>
    </form>
  );
}
