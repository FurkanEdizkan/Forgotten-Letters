/**
 * Full Auth.js configuration — Node runtime only.
 *
 * Extends the edge-safe base in config.edge.ts with providers that need
 * the database and bcrypt. Never import this from middleware; see the
 * note in config.edge.ts.
 *
 * OAuth providers register only when their credentials are present, so
 * local development works without Google/GitHub apps configured.
 */
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { loginSchema } from "@/lib/validations/auth";
import { edgeAuthConfig } from "./config.edge";

/**
 * A bcrypt hash of a throwaway value, compared against when no user is
 * found. Without it, "unknown email" returns immediately while "known
 * email, wrong password" takes ~250ms of hashing — a timing oracle that
 * enumerates registered accounts.
 */
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.uQGYAkKQMy7hJqQpDKGVwXHqOKPRAiO";

function oauthProviders() {
  const providers = [];
  if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
    providers.push(
      Google({
        clientId: env.AUTH_GOOGLE_ID,
        clientSecret: env.AUTH_GOOGLE_SECRET,
        // Linking by email alone lets someone who controls a matching
        // address take over an existing account.
        allowDangerousEmailAccountLinking: false,
      }),
    );
  }
  if (env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET) {
    providers.push(
      GitHub({
        clientId: env.AUTH_GITHUB_ID,
        clientSecret: env.AUTH_GITHUB_SECRET,
        allowDangerousEmailAccountLinking: false,
      }),
    );
  }
  return providers;
}

export const authConfig = {
  ...edgeAuthConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        // Always run a comparison, even with no user, to keep timing flat.
        const hash = user?.passwordHash ?? DUMMY_HASH;
        const ok = await bcrypt.compare(password, hash);

        // A user without a passwordHash registered via OAuth. Refuse
        // rather than letting a password be set on someone else's email.
        if (!ok || !user || !user.passwordHash) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
    ...oauthProviders(),
  ],
} satisfies NextAuthConfig;
