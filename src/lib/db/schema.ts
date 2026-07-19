/**
 * Drizzle schema.
 *
 * Phase 0 defines only the Auth.js adapter tables — the minimal set that
 * proves the migration pipeline works end to end and that Phase 1's auth
 * work needs on day one. The full domain schema (profiles, campaigns,
 * scenarios, votes, subscriptions, entitlements, …) lands in Phase 2; see
 * docs/Architecture.md "Data layer".
 *
 * Table shapes here are dictated by @auth/drizzle-adapter — column names
 * and types must match what the adapter queries, so do not rename them.
 */
import type { AdapterAccountType } from "next-auth/adapters";
import {
  integer,
  primaryKey,
  text,
  timestamp,
  pgTable,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date", withTimezone: true }),
  image: text("image"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// Drizzle-inferred types replace the old `supabase gen types` step
// (docs/Architecture.md, old→new mapping).
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
