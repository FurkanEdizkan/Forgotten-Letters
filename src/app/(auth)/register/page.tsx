import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/AuthShell";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { Divider } from "@/components/auth/Divider";
import { RegisterForm } from "@/components/auth/RegisterForm";

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
      <RegisterForm />
    </AuthShell>
  );
}
