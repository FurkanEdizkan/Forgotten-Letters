/**
 * Drizzle schema.
 *
 * Phase 0 defined the Auth.js adapter tables, Phase 1 added credentials
 * and profiles, Phase 2 adds the content domain and monetization tables.
 * See docs/Architecture.md "Data layer".
 *
 * Table shapes for users/accounts/sessions/verificationToken are dictated
 * by @auth/drizzle-adapter — column names and types must match what the
 * adapter queries, so do not rename them. Columns we add beyond the
 * adapter's expectations are safe.
 *
 * Ownership columns are named `authorId` and are the anchor for every
 * authorization check: the database no longer enforces per-row access
 * (Supabase RLS is gone), so src/lib/auth/guards.ts is the only thing
 * standing between a user and someone else's rows.
 */
import type { AdapterAccountType } from "next-auth/adapters";
import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
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
  // TOTP shared secret, base32. Present but unconfirmed means enrolment
  // was started and never verified, so 2FA is NOT yet enforced —
  // otherwise a half-finished setup would lock the user out.
  totpSecret: text("totpSecret"),
  totpConfirmedAt: timestamp("totpConfirmedAt", { withTimezone: true }),
  // Single-use recovery codes, stored as bcrypt hashes. The only way
  // back in if the authenticator device is lost.
  totpRecoveryCodes: text("totpRecoveryCodes").array(),
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
    // bigint to match uploaded_files.sizeBytes — an int4 counter
    // overflows at 2 GB of cumulative uploads.
    storageUsedBytes: bigint("storageUsedBytes", { mode: "number" })
      .notNull()
      .default(0),
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

/* ══════════════════════════════════════════════════════════════════
   Phase 2 — content domain
   ══════════════════════════════════════════════════════════════════ */

export const sectionTypeEnum = pgEnum("section_type", [
  "narrative",
  "objectives",
  "deployment",
  "special_rules",
  "victory_conditions",
  "event_table",
  "aftermath",
]);

/** Polymorphic target for votes, favorites, and comments. */
export const targetTypeEnum = pgEnum("target_type", [
  "scenario",
  "campaign",
  "warband",
  "comment",
]);

export const subscriptionTierEnum = pgEnum("subscription_tier", [
  "conscript", // free
  "veteran",
  "cartographer",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "past_due",
  "canceled",
  "incomplete",
]);

export const forgeJobStatusEnum = pgEnum("forge_job_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
]);

/** Game systems. Trench Crusade first; the schema is system-agnostic. */
export const gameSystems = pgTable(
  "game_systems",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    publisher: text("publisher"),
    description: text("description"),
    isActive: boolean("isActive").notNull().default(true),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("game_systems_slug_idx").on(t.slug)],
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    authorId: text("authorId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameSystemId: text("gameSystemId")
      .notNull()
      .references(() => gameSystems.id, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    // Node-based campaign graph: nodes + edges with branching paths.
    // JSONB rather than tables because the shape is editor-driven and
    // is always read and written whole.
    graph: jsonb("graph"),
    isPublished: boolean("isPublished").notNull().default(false),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Slugs are unique per author, so two users may both have
    // "the-long-retreat" without colliding.
    uniqueIndex("campaigns_author_slug_idx").on(t.authorId, t.slug),
    index("campaigns_author_idx").on(t.authorId),
    index("campaigns_published_idx").on(t.isPublished),
    index("campaigns_created_idx").on(t.createdAt),
  ],
);

export const scenarios = pgTable(
  "scenarios",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    authorId: text("authorId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameSystemId: text("gameSystemId")
      .notNull()
      .references(() => gameSystems.id, { onDelete: "restrict" }),
    // Nullable: a scenario can stand alone or belong to a campaign.
    // set null (not cascade) so deleting a campaign does not destroy
    // scenarios the author may still want.
    campaignId: text("campaignId").references(() => campaigns.id, {
      onDelete: "set null",
    }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    playerCount: smallint("playerCount"),
    estimatedMinutes: smallint("estimatedMinutes"),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    // Konva map document. Whole-document read/write, same as graph.
    mapData: jsonb("mapData"),
    isPublished: boolean("isPublished").notNull().default(false),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("scenarios_author_slug_idx").on(t.authorId, t.slug),
    index("scenarios_author_idx").on(t.authorId),
    index("scenarios_campaign_idx").on(t.campaignId),
    index("scenarios_published_idx").on(t.isPublished),
    index("scenarios_created_idx").on(t.createdAt),
    index("scenarios_system_idx").on(t.gameSystemId),
  ],
);

/** Ordered rich-text blocks making up a scenario. */
export const scenarioSections = pgTable(
  "scenario_sections",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    scenarioId: text("scenarioId")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    type: sectionTypeEnum("type").notNull(),
    heading: text("heading"),
    // Sanitized HTML from Tiptap. Sanitization happens on write, in the
    // server action — never trust it at render time.
    body: text("body"),
    position: smallint("position").notNull().default(0),
  },
  (t) => [index("scenario_sections_scenario_idx").on(t.scenarioId, t.position)],
);

/** Roll tables attached to a scenario section. */
export const eventTables = pgTable(
  "event_tables",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    scenarioId: text("scenarioId")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    diceNotation: text("diceNotation").notNull().default("d6"),
    // [{ min, max, result }] — read and written whole by the editor.
    entries: jsonb("entries")
      .notNull()
      .default(sql`'[]'::jsonb`),
    position: smallint("position").notNull().default(0),
  },
  (t) => [index("event_tables_scenario_idx").on(t.scenarioId)],
);

/**
 * Uploaded objects.
 *
 * Rows are the source of truth for quota accounting: the storage
 * counter on profiles is maintained from inserts and deletes here, so
 * every upload must be recorded even when the bytes land in R2 first.
 */
export const uploadedFiles = pgTable(
  "uploaded_files",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bucket: text("bucket").notNull(),
    objectKey: text("objectKey").notNull(),
    mimeType: text("mimeType").notNull(),
    // bigint: an int4 column overflows at 2 GB, which a single user's
    // cumulative uploads can exceed.
    sizeBytes: bigint("sizeBytes", { mode: "number" }).notNull(),
    // Temp uploads are swept by the cleanup task; permanent ones are not.
    isTemporary: boolean("isTemporary").notNull().default(false),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uploaded_files_bucket_key_idx").on(t.bucket, t.objectKey),
    index("uploaded_files_user_idx").on(t.userId),
    index("uploaded_files_temp_idx").on(t.isTemporary, t.createdAt),
  ],
);

/**
 * Votes. One row per user per target; `value` is +1 or -1.
 * The unique constraint is what makes a vote idempotent — re-voting
 * updates rather than accumulating.
 */
export const votes = pgTable(
  "votes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: targetTypeEnum("targetType").notNull(),
    targetId: text("targetId").notNull(),
    value: smallint("value").notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("votes_user_target_unq").on(t.userId, t.targetType, t.targetId),
    index("votes_target_idx").on(t.targetType, t.targetId),
  ],
);

export const favorites = pgTable(
  "favorites",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: targetTypeEnum("targetType").notNull(),
    targetId: text("targetId").notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("favorites_user_target_unq").on(t.userId, t.targetType, t.targetId),
    index("favorites_target_idx").on(t.targetType, t.targetId),
    index("favorites_user_idx").on(t.userId),
  ],
);

/** Threaded comments. parentId nests a reply under another comment. */
export const comments = pgTable(
  "comments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    authorId: text("authorId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: targetTypeEnum("targetType").notNull(),
    targetId: text("targetId").notNull(),
    // Self-reference needs the AnyPgColumn annotation to break the
    // circular type. Cascade so deleting a comment removes its replies
    // rather than orphaning them.
    parentId: text("parentId").references((): AnyPgColumn => comments.id, {
      onDelete: "cascade",
    }),
    // Sanitized on write, in the server action.
    body: text("body").notNull(),
    isDeleted: boolean("isDeleted").notNull().default(false),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("comments_target_idx").on(t.targetType, t.targetId),
    index("comments_author_idx").on(t.authorId),
    index("comments_parent_idx").on(t.parentId),
  ],
);

/* ══════════════════════════════════════════════════════════════════
   Phase 2 — monetization
   ══════════════════════════════════════════════════════════════════ */

/** Mirror of the Stripe subscription. Stripe remains the source of truth. */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    stripeCustomerId: text("stripeCustomerId"),
    stripeSubscriptionId: text("stripeSubscriptionId"),
    tier: subscriptionTierEnum("tier").notNull().default("conscript"),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    currentPeriodEnd: timestamp("currentPeriodEnd", { withTimezone: true }),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("subscriptions_customer_idx").on(t.stripeCustomerId),
    index("subscriptions_subscription_idx").on(t.stripeSubscriptionId),
  ],
);

/**
 * Flattened feature flags, derived from subscription plus donations.
 *
 * Denormalized deliberately: every request that renders an ad slot or
 * checks a quota reads this, and recomputing it from Stripe state on
 * each read would be both slow and unavailable when Stripe is down.
 */
export const entitlements = pgTable("entitlements", {
  userId: text("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  adsDisabled: boolean("adsDisabled").notNull().default(false),
  // Default 50 MB free tier; overridden per-tier. bigint for the same
  // overflow reason as uploaded_files.sizeBytes.
  storageQuotaBytes: bigint("storageQuotaBytes", { mode: "number" })
    .notNull()
    .default(52_428_800),
  forgeCredits: integer("forgeCredits").notNull().default(0),
  privateCampaigns: boolean("privateCampaigns").notNull().default(false),
  isSupporter: boolean("isSupporter").notNull().default(false),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

/** AI Forge runs, and the credit accounting behind them. */
export const forgeJobs = pgTable(
  "forge_jobs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    provider: text("provider").notNull(),
    sourceAssetKey: text("sourceAssetKey"),
    outputImageKey: text("outputImageKey"),
    outputMeshKey: text("outputMeshKey"),
    status: forgeJobStatusEnum("status").notNull().default("queued"),
    creditsSpent: integer("creditsSpent").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completedAt", { withTimezone: true }),
  },
  (t) => [
    index("forge_jobs_user_idx").on(t.userId, t.createdAt),
    index("forge_jobs_status_idx").on(t.status),
  ],
);

export type GameSystem = typeof gameSystems.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type Scenario = typeof scenarios.$inferSelect;
export type NewScenario = typeof scenarios.$inferInsert;
export type ScenarioSection = typeof scenarioSections.$inferSelect;
export type EventTable = typeof eventTables.$inferSelect;
export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type Vote = typeof votes.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Entitlement = typeof entitlements.$inferSelect;
export type ForgeJob = typeof forgeJobs.$inferSelect;

/* ══════════════════════════════════════════════════════════════════
   Phase 7 — notifications
   ══════════════════════════════════════════════════════════════════ */

export const notificationTypeEnum = pgEnum("notification_type", [
  "comment_on_scenario",
  "reply_to_comment",
  "scenario_voted",
]);

/**
 * In-app notifications.
 *
 * `actorId` is the person who caused it; `userId` is the recipient.
 * Both cascade from users, so deleting an account removes both the
 * notifications it received and the ones it caused — otherwise a
 * deleted user's name would linger in other people's feeds.
 *
 * The target is stored as type + id rather than a foreign key because
 * it is polymorphic, the same as votes and comments. `url` is
 * denormalized at write time so rendering the feed needs no per-row
 * lookup to build a link.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorId: text("actorId").references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    isRead: boolean("isRead").notNull().default(false),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The unread badge queries this on every page load.
    index("notifications_user_unread_idx").on(t.userId, t.isRead),
    index("notifications_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export type Notification = typeof notifications.$inferSelect;

/* ══════════════════════════════════════════════════════════════════
   Phase 7 — battle tracker
   ══════════════════════════════════════════════════════════════════ */

export const battleResultEnum = pgEnum("battle_result", ["win", "loss", "draw"]);

/**
 * A played game.
 *
 * Recorded against a campaign, optionally naming the scenario played.
 * scenarioId is set null rather than cascaded on scenario deletion:
 * losing the scenario should not erase the record that a game happened.
 */
export const battles = pgTable(
  "battles",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    campaignId: text("campaignId")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    scenarioId: text("scenarioId").references(() => scenarios.id, {
      onDelete: "set null",
    }),
    // Who recorded it — the campaign owner. Used for authorization.
    recordedById: text("recordedById")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    playedAt: timestamp("playedAt", { withTimezone: true }).notNull().defaultNow(),
    // Sanitized on write, like every other user-authored body.
    notes: text("notes"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("battles_campaign_idx").on(t.campaignId, t.playedAt),
    index("battles_scenario_idx").on(t.scenarioId),
  ],
);

/**
 * One side of a battle.
 *
 * `warbandId` is deliberately absent until Phase 6 defines warbands —
 * adding it later is an additive migration, whereas blocking the battle
 * tracker on an undefined model would stall Phase 7 for no reason.
 * Participants are named free-text so a campaign can record games
 * against people who have no account here.
 */
export const battleParticipants = pgTable(
  "battle_participants",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    battleId: text("battleId")
      .notNull()
      .references(() => battles.id, { onDelete: "cascade" }),
    // Null when the participant is not a registered user.
    userId: text("userId").references(() => users.id, { onDelete: "set null" }),
    displayName: text("displayName").notNull(),
    result: battleResultEnum("result").notNull(),
    score: smallint("score"),
  },
  (t) => [index("battle_participants_battle_idx").on(t.battleId)],
);

export type Battle = typeof battles.$inferSelect;
export type BattleParticipant = typeof battleParticipants.$inferSelect;
