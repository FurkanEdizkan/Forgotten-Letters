import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/layout/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "Set a new password" };

export default function ResetPasswordPage() {
  return (
    <AuthShell
      eyebrow="Access // Recovery"
      title="New orders"
      subtitle="Choose a new password for your account."
      footer={
        <>
          Changed your mind?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Back to log in
          </Link>
        </>
      }
    >
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
