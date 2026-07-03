import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/AuthShell";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { Divider } from "@/components/auth/Divider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Access // Login"
      title="Report for duty"
      subtitle="Sign in to manage your scenarios and campaigns."
      footer={
        <>
          No account yet?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Enlist here
          </Link>
        </>
      }
    >
      <GoogleButton label="Log in with Google" />
      <div className="my-5">
        <Divider />
      </div>
      <form className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="soldier@front.line" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="font-mono text-[0.625rem] uppercase tracking-wider text-faint hover:text-primary"
            >
              Forgot?
            </Link>
          </div>
          <Input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
        </div>
        <Button type="submit" size="lg" className="mt-2 w-full">
          Log in
        </Button>
      </form>
    </AuthShell>
  );
}
