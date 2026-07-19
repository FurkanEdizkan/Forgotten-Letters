/**
 * Drizzle schema.
 *
 * Phase 0 defined the Auth.js adapter tables; Phase 1 adds credentials
 * support and the public `profiles` row every user gets. The rest of the
 * domain (campaigns, scenarios, votes, subscriptions, entitlements, …)
 * lands in Phase 2; see docs/Architecture.md "Data layer".
 *
 * Table shapes for users/accounts/sessions/verificationToken are dictated
 * by @auth/drizzle-adapter — column names and types must match what the
 * adapter queries, so do not rename them. Columns we add beyond the
 * adapter's expectations are safe.
 */
import type { AdapterAccountType } from "next-auth/adapters";
import {
  boolean,
  index,
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
  // bcrypt hash. Null for OAuth-only accounts, which have no password —
  // the Credentials provider must treat null as "cannot log in this way"
  // rather than comparing against it.
  passwordHash: text("passwordHash"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Public-facing user data, split from `users` so that private fields
 * (email, password hash) are never one careless `select *` away from a
 * public profile page.
 */
export const profiles = pgTable(
  "profiles",
  {
    userId: text("userId")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    username: text("username").notNull().unique(),
    displayName: text("displayName"),
    bio: text("bio"),
    avatarKey: text("avatarKey"),
    storageUsedBytes: integer("storageUsedBytes").notNull().default(0),
    isAdmin: boolean("isAdmin").notNull().default(false),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("profiles_username_idx").on(t.username)],
);

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
  (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })],
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
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
