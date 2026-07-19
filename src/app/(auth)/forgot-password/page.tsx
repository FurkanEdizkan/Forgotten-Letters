import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Access // Recovery"
      title="Lost your orders?"
      subtitle="Enter your email and we'll send a reset link to the front."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Back to log in
          </Link>
        </>
      }
    >
      <form className="flex flex-col gap-4">
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
        <Button type="submit" size="lg" className="mt-2 w-full">
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}
