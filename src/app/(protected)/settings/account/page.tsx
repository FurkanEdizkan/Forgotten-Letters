import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Account Settings" };

export default function AccountSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <h2 className="font-display text-lg font-semibold text-ink">Email</h2>
        <p className="mt-1 text-sm text-muted">
          A confirmation is sent to the new address before it takes effect.
        </p>
        <div className="mt-5 flex flex-col gap-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" defaultValue="soldier@front.line" />
        </div>
        <div className="mt-5 flex justify-end">
          <Button>Update email</Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-lg font-semibold text-ink">Password</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input id="new-password" type="password" autoComplete="new-password" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-password">Confirm</Label>
            <Input id="confirm-password" type="password" autoComplete="new-password" />
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button>Change password</Button>
        </div>
      </Card>

      {/* Danger zone — full border + tint, never a side-stripe */}
      <Card className="border-danger/40 bg-[oklch(0.2_0.03_25)] p-6">
        <h2 className="font-display text-lg font-semibold text-ink">Delete account</h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Permanently remove your account and all associated scenarios, campaigns, and
          uploads. This cannot be undone.
        </p>
        <div className="mt-5">
          <Button variant="danger">Delete my account</Button>
        </div>
      </Card>
    </div>
  );
}
