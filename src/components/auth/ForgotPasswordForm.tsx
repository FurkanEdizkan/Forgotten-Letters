"use client";

import { useState, useTransition } from "react";

import { requestPasswordResetAction } from "@/lib/actions/password-reset";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordResetAction(formData);
      if (result.ok) setSent(true);
      else setError(result.error);
    });
  }

  if (sent) {
    // Deliberately unconditional: saying "we sent it" only when the
    // address exists would reveal which addresses are registered.
    return (
      <p className="rounded border border-border bg-elevated px-3 py-3 text-sm text-ink">
        If that address has an account, a reset link is on its way. The link is valid
        for one hour.
      </p>
    );
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
      <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
