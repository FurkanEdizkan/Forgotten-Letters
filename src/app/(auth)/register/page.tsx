import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/AuthShell";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { Divider } from "@/components/auth/Divider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

export const metadata: Metadata = { title: "Enlist" };

export default function RegisterPage() {
  return (
    <AuthShell
      eyebrow="Access // Register"
      title="Enlist"
      subtitle="Create an account to forge and publish scenarios."
      footer={
        <>
          Already enlisted?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <GoogleButton label="Sign up with Google" />
      <div className="my-5">
        <Divider />
      </div>
      <form className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="username">Callsign</Label>
          <Input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder="e.g. trench_rat"
            required
          />
        </div>
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
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            required
            minLength={8}
          />
        </div>
        <Button type="submit" size="lg" className="mt-2 w-full">
          Enlist
        </Button>
        <p className="text-center text-xs leading-relaxed text-faint">
          By enlisting you agree to the terms of service and privacy policy.
        </p>
      </form>
    </AuthShell>
  );
}
