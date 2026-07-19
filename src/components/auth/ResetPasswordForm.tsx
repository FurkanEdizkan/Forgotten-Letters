"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { resetPasswordAction } from "@/lib/actions/password-reset";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";

  function onSubmit(formData: FormData) {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await resetPasswordAction(formData);
      if (result.ok) {
        setDone(true);
      } else {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      }
    });
  }

  if (!token || !email) {
    return (
      <p
        role="alert"
        className="rounded border border-border bg-elevated px-3 py-3 text-sm text-ink"
      >
        This reset link is incomplete. Request a new one from the forgot-password page.
      </p>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded border border-border bg-elevated px-3 py-3 text-sm text-ink">
          Password changed. You can sign in with it now.
        </p>
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={() => router.push("/login")}
        >
          Continue to log in
        </Button>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="email" value={email} />

      {error && (
        <p
          role="alert"
          className="rounded border border-primary/40 bg-primary-soft px-3 py-2 text-sm text-primary-ink"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={fieldErrors.password ? "password-error" : undefined}
          required
        />
        {fieldErrors.password ? (
          <p id="password-error" className="text-xs text-primary">
            {fieldErrors.password[0]}
          </p>
        ) : (
          <p className="text-xs text-faint">At least 12 characters.</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          aria-invalid={fieldErrors.confirmPassword ? true : undefined}
          aria-describedby={
            fieldErrors.confirmPassword ? "confirmPassword-error" : undefined
          }
          required
        />
        {fieldErrors.confirmPassword && (
          <p id="confirmPassword-error" className="text-xs text-primary">
            {fieldErrors.confirmPassword[0]}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>
        {pending ? "Changing…" : "Change password"}
      </Button>
    </form>
  );
}
