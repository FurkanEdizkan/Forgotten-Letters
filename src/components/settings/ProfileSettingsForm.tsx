"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { updateProfileAction } from "@/lib/actions/profile";

export function ProfileSettingsForm({
  initial,
}: {
  initial: { username: string; displayName: string; bio: string };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    setFieldErrors({});
    setNotice(null);
    startTransition(async () => {
      const result = await updateProfileAction(formData);
      if (result.ok) {
        setNotice("Profile saved.");
        router.refresh();
      } else {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      }
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-5">
      {error && (
        <p
          role="alert"
          className="rounded border border-primary/40 bg-primary-soft px-3 py-2 text-sm text-primary-ink"
        >
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded border border-border bg-elevated px-3 py-2 text-sm text-ink">
          {notice}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          defaultValue={initial.username}
          aria-invalid={fieldErrors.username ? true : undefined}
        />
        {fieldErrors.username ? (
          <p id="username-error" className="text-xs text-primary">
            {fieldErrors.username[0]}
          </p>
        ) : (
          <p className="text-xs text-faint">
            Changing this changes your profile and scenario URLs.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          name="displayName"
          defaultValue={initial.displayName}
          placeholder="Shown instead of your username"
        />
        {fieldErrors.displayName && (
          <p id="displayName-error" className="text-xs text-primary">
            {fieldErrors.displayName[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          name="bio"
          defaultValue={initial.bio}
          rows={4}
          placeholder="A line or two about you."
        />
        {fieldErrors.bio && (
          <p id="bio-error" className="text-xs text-primary">
            {fieldErrors.bio[0]}
          </p>
        )}
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
