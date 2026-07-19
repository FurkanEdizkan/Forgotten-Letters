/**
 * Augments Auth.js types so `session.user.id` is typed.
 * Auth.js's default Session["user"] has no id field.
 */
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
