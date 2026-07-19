import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/AuthShell";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { Divider } from "@/components/auth/Divider";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

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
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
