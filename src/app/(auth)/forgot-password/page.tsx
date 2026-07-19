import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

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
      <ForgotPasswordForm />
    </AuthShell>
  );
}
