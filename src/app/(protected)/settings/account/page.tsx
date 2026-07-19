import type { Metadata } from "next";

import { DeleteAccountForm } from "@/components/settings/DeleteAccountForm";
import { requireUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Account settings" };

export default async function AccountSettingsPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-display text-2xl text-ink">Account</h2>
        <p className="mt-1 text-sm text-muted">Sign-in and account controls.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[0.625rem] uppercase tracking-wider text-faint">
          Email
        </span>
        <p className="text-sm text-ink">{user.email}</p>
        <p className="text-xs text-faint">
          Changing your email is not implemented yet — it needs a verification
          round-trip to the new address before the change can take effect.
        </p>
      </div>

      <DeleteAccountForm email={user.email} />
    </div>
  );
}
