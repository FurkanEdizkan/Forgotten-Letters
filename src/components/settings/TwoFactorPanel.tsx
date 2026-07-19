"use client";

/**
 * Two-factor setup.
 *
 * Three states: off, mid-enrolment (secret issued, not yet proven), and
 * on. Enrolment only completes once a valid code is entered, so
 * abandoning setup leaves the account exactly as it was.
 */
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  confirmTotpEnrollmentAction,
  disableTotpAction,
  startTotpEnrollmentAction,
  type EnrollmentStart,
} from "@/lib/actions/totp";

export function TwoFactorPanel({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<EnrollmentStart | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start() {
    setError(null);
    startTransition(async () => {
      const result = await startTotpEnrollmentAction();
      if (result.ok) setEnrollment(result.data);
      else setError(result.error);
    });
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await confirmTotpEnrollmentAction(code);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRecoveryCodes(result.data.recoveryCodes);
      setEnrollment(null);
      setCode("");
      router.refresh();
    });
  }

  function disable() {
    setError(null);
    startTransition(async () => {
      const result = await disableTotpAction(code);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCode("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border p-5">
      <div className="flex items-start gap-3">
        {enabled ? (
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" />
        ) : (
          <ShieldOff className="mt-0.5 size-5 shrink-0 text-faint" />
        )}
        <div>
          <h3 className="font-display text-lg text-ink">Two-factor authentication</h3>
          <p className="mt-1 text-sm text-muted">
            {enabled
              ? "Enabled. You will be asked for a code when signing in."
              : "Add a code from an authenticator app to your sign-in."}
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

      {/* Shown once, immediately after enrolment. */}
      {recoveryCodes && (
        <div className="rounded border border-accent/40 bg-accent-soft p-4">
          <h4 className="font-display text-base text-ink">Save your recovery codes</h4>
          <p className="mt-1 text-sm text-muted">
            These are shown once and are the only way in if you lose your device. Each
            works a single time.
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-1 font-mono text-sm text-ink">
            {recoveryCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => setRecoveryCodes(null)}
          >
            I have saved them
          </Button>
        </div>
      )}

      {!enabled && !enrollment && !recoveryCodes && (
        <div>
          <Button onClick={start} disabled={pending}>
            {pending ? "Preparing…" : "Set up two-factor"}
          </Button>
        </div>
      )}

      {enrollment && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Scan this with your authenticator app, then enter the six-digit code it
            shows.
          </p>
          <Image
            src={enrollment.qrDataUrl}
            alt="Two-factor setup QR code"
            width={200}
            height={200}
            unoptimized
            className="rounded border border-border bg-white p-2"
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="totp-secret">Or enter this key manually</Label>
            <code
              id="totp-secret"
              className="break-all rounded bg-elevated px-2 py-1 font-mono text-xs text-accent"
            >
              {enrollment.secret}
            </code>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="totp-code">Six-digit code</Label>
            <Input
              id="totp-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className="max-w-40"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={confirm} disabled={pending || code.trim().length < 6}>
              {pending ? "Verifying…" : "Verify and enable"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setEnrollment(null);
                setCode("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {enabled && !recoveryCodes && (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <Label htmlFor="totp-disable">
            Enter a current code or a recovery code to turn it off
          </Label>
          <div className="flex gap-2">
            <Input
              id="totp-disable"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              placeholder="123456"
              className="max-w-52"
            />
            <Button
              variant="danger"
              onClick={disable}
              disabled={pending || !code.trim()}
            >
              {pending ? "Disabling…" : "Disable"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
