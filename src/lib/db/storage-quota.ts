/**
 * Storage quota accounting.
 *
 * Replaces the Supabase `check_user_storage_quota` and
 * `update_storage_used` triggers (docs/Architecture.md, Data layer).
 * The quota comes from `entitlements.storageQuotaBytes`, never a
 * hard-coded constant, so supporter tiers raise it without a code change.
 *
 * `profiles.storageUsedBytes` is a cache of SUM(uploaded_files.sizeBytes)
 * for the user. It is maintained transactionally alongside every insert
 * and delete here — if you add another write path to uploaded_files, it
 * must go through these helpers or the counter silently drifts.
 */
import { and, eq, sql } from "drizzle-orm";

import { db } from "./client";
import { entitlements, profiles, uploadedFiles } from "./schema";

export type QuotaCheck = {
  allowed: boolean;
  usedBytes: number;
  quotaBytes: number;
  remainingBytes: number;
};

/** Entitlements row, created with defaults on first access. */
export async function getOrCreateEntitlements(userId: string) {
  const [existing] = await db
    .select()
    .from(entitlements)
    .where(eq(entitlements.userId, userId))
    .limit(1);
  if (existing) return existing;

  // onConflictDoNothing: two concurrent requests for a new user would
  // otherwise race and one would throw on the primary key.
  await db.insert(entitlements).values({ userId }).onConflictDoNothing();

  const [created] = await db
    .select()
    .from(entitlements)
    .where(eq(entitlements.userId, userId))
    .limit(1);
  return created;
}

/**
 * Whether `additionalBytes` would fit within the user's quota.
 *
 * Advisory only — it reflects state at call time. The authoritative
 * check is inside recordUpload's transaction, which re-verifies before
 * committing so two concurrent uploads cannot both pass.
 */
export async function checkStorageQuota(
  userId: string,
  additionalBytes: number,
): Promise<QuotaCheck> {
  const ent = await getOrCreateEntitlements(userId);

  const [profile] = await db
    .select({ used: profiles.storageUsedBytes })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  const usedBytes = profile?.used ?? 0;
  const quotaBytes = ent?.storageQuotaBytes ?? 0;

  return {
    allowed: usedBytes + additionalBytes <= quotaBytes,
    usedBytes,
    quotaBytes,
    remainingBytes: Math.max(0, quotaBytes - usedBytes),
  };
}

export class QuotaExceededError extends Error {
  constructor(readonly check: QuotaCheck) {
    super("Storage quota exceeded");
    this.name = "QuotaExceededError";
  }
}

/**
 * Record an upload and increment the counter atomically.
 *
 * Re-checks the quota inside the transaction: without that, two uploads
 * that each pass an advisory check can both commit and push the user
 * over their limit.
 */
export async function recordUpload(input: {
  userId: string;
  bucket: string;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  isTemporary?: boolean;
}) {
  return db.transaction(async (tx) => {
    const [ent] = await tx
      .select({ quota: entitlements.storageQuotaBytes })
      .from(entitlements)
      .where(eq(entitlements.userId, input.userId))
      .limit(1);

    // Lock the profile row so a concurrent upload cannot read the same
    // pre-increment value and both commit.
    const [profile] = await tx
      .select({ used: profiles.storageUsedBytes })
      .from(profiles)
      .where(eq(profiles.userId, input.userId))
      .for("update")
      .limit(1);

    const used = profile?.used ?? 0;
    const quota = ent?.quota ?? 0;

    if (used + input.sizeBytes > quota) {
      throw new QuotaExceededError({
        allowed: false,
        usedBytes: used,
        quotaBytes: quota,
        remainingBytes: Math.max(0, quota - used),
      });
    }

    const [file] = await tx
      .insert(uploadedFiles)
      .values({
        userId: input.userId,
        bucket: input.bucket,
        objectKey: input.objectKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        isTemporary: input.isTemporary ?? false,
      })
      .returning();

    await tx
      .update(profiles)
      .set({ storageUsedBytes: sql`${profiles.storageUsedBytes} + ${input.sizeBytes}` })
      .where(eq(profiles.userId, input.userId));

    return file;
  });
}

/**
 * Delete an upload record and decrement the counter.
 *
 * Returns the removed row so the caller can delete the object from R2.
 * Scoped by userId: passing someone else's file id deletes nothing
 * rather than another user's row.
 */
export async function deleteUpload(userId: string, fileId: string) {
  return db.transaction(async (tx) => {
    const [file] = await tx
      .delete(uploadedFiles)
      .where(and(eq(uploadedFiles.id, fileId), eq(uploadedFiles.userId, userId)))
      .returning();

    if (!file) return null;

    await tx
      .update(profiles)
      .set({
        // GREATEST guards against a negative counter if a row was ever
        // removed outside this helper.
        storageUsedBytes: sql`GREATEST(0, ${profiles.storageUsedBytes} - ${file.sizeBytes})`,
      })
      .where(eq(profiles.userId, userId));

    return file;
  });
}

/**
 * Recompute the cached counter from the rows themselves.
 * The repair path for drift, and what the tests assert against.
 */
export async function recalculateStorageUsed(userId: string): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${uploadedFiles.sizeBytes}), 0)::bigint`,
    })
    .from(uploadedFiles)
    .where(eq(uploadedFiles.userId, userId));

  const total = Number(row?.total ?? 0);
  await db
    .update(profiles)
    .set({ storageUsedBytes: total })
    .where(eq(profiles.userId, userId));
  return total;
}
