import type { Metadata } from "next";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Profile Settings" };

export default function ProfileSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <h2 className="font-display text-lg font-semibold text-ink">Identity</h2>
        <p className="mt-1 text-sm text-muted">
          How you appear across the archive.
        </p>

        <div className="mt-5 flex items-center gap-4">
          <Avatar name="trench_rat" size="lg" />
          <Button variant="outline" size="sm">
            Change avatar
          </Button>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="display">Display name</Label>
            <Input id="display" defaultValue="Trench Rat" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username">Callsign</Label>
            <Input id="username" defaultValue="trench_rat" />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-1.5">
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" placeholder="A line or two about your warband and playstyle." />
        </div>

        <div className="mt-6 flex justify-end">
          <Button>Save changes</Button>
        </div>
      </Card>
    </div>
  );
}
