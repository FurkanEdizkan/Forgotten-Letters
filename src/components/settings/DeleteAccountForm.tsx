"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { deleteAccountAction } from "@/lib/actions/profile";

/**
 * Account deletion.
 *
 * Requires typing the account's email exactly. The action cascades to
 * every row the user owns, so a single mis-click must not be enough.
 */
export function DeleteAccountForm({ email }: { email: string }) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteAccountAction(confirmation);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-danger/40 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" />
        <div>
          <h3 className="font-display text-lg text-ink">Delete account</h3>
          <p className="mt-1 text-sm text-muted">
            This removes your profile, scenarios, campaigns, comments, votes, and
            uploads. It cannot be undone.
          </p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded border border-primary/40 bg-primary-soft px-3 py-2 text-sm text-primary-ink"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmation">
          Type <span className="font-mono text-ink">{email}</span> to confirm
        </Label>
        <Input
          id="confirmation"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="off"
          placeholder={email}
        />
      </div>

      <div>
        <Button
          variant="danger"
          onClick={onDelete}
          disabled={pending || confirmation !== email}
        >
          {pending ? "Deleting…" : "Delete my account"}
        </Button>
      </div>
    </div>
  );
}
