"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { registerAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await registerAction(formData);
      if (result.ok) {
        setDone(true);
      } else {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      }
    });
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded border border-border bg-elevated px-3 py-3 text-sm text-ink">
          Check your inbox — we&apos;ve sent a message to the address you provided.
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
      {error && (
        <p
          role="alert"
          className="rounded border border-primary/40 bg-primary-soft px-3 py-2 text-sm text-primary-ink"
        >
          {error}
        </p>
      )}

      <Field
        id="username"
        label="Username"
        type="text"
        autoComplete="username"
        placeholder="trench_rat"
        errors={fieldErrors.username}
        hint="3–24 characters: lowercase letters, numbers, underscores."
      />
      <Field
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="soldier@front.line"
        errors={fieldErrors.email}
      />
      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        errors={fieldErrors.password}
        hint="At least 12 characters."
      />

      <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>
        {pending ? "Enlisting…" : "Enlist"}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  type,
  autoComplete,
  placeholder,
  errors,
  hint,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  placeholder: string;
  errors?: string[];
  hint?: string;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={errors ? true : undefined}
        aria-describedby={errors ? errorId : undefined}
        required
      />
      {errors ? (
        <p id={errorId} className="text-xs text-primary">
          {errors[0]}
        </p>
      ) : hint ? (
        <p className="text-xs text-faint">{hint}</p>
      ) : null}
    </div>
  );
}
