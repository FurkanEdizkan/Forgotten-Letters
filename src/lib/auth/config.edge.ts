/**
 * Edge-safe Auth.js configuration.
 *
 * Deliberately imports nothing Node-only. Middleware runs on the Edge
 * runtime, and importing the full config there drags in `pg` and
 * `bcryptjs` through the Credentials provider — which fails at runtime
 * with "The edge runtime does not support Node.js 'crypto' module".
 *
 * Note this is a *runtime* failure, not a build one: `next build`
 * succeeds and the error only appears on the first request through
 * middleware. Keep this file free of database, crypto, and provider
 * imports.
 *
 * Session strategy is JWT, not database. Auth.js has no adapter hook to
 * persist a session row for Credentials sign-ins, so `strategy:
 * "database"` silently produces a signed-out session on every request.
 * Email+password is required here, so JWT is the only workable choice;
 * the adapter still owns users and OAuth accounts.
 */
import type { NextAuthConfig } from "next-auth";

export const edgeAuthConfig = {
  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  // Real providers are attached in config.ts, which is Node-only.
  providers: [],

  callbacks: {
    async jwt({ token, user }) {
      // Only present on initial sign-in; persist the id for later requests.
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
