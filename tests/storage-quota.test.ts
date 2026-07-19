/**
 * Storage quota + vote integration tests.
 *
 * These run against the real compose Postgres, not mocks — the point is
 * to prove the transactional counter and the unique constraints behave,
 * which a mock cannot tell us. Requires `docker compose up`.
 *
 * Each test creates its own users and cleans up after itself.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

const { db } = await import("@/lib/db/client");
const { entitlements, profiles, users, uploadedFiles, votes } =
  await import("@/lib/db/schema");
const {
  QuotaExceededError,
  checkStorageQuota,
  deleteUpload,
  recalculateStorageUsed,
  recordUpload,
} = await import("@/lib/db/storage-quota");
const { castVote, clearVote, getVoteCount, getVoteCounts } =
  await import("@/lib/db/votes");

const createdUserIds: string[] = [];

async function makeUser(quotaBytes?: number) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const [user] = await db
    .insert(users)
    .values({ email: `quota${stamp}@test.local` })
    .returning();
  await db.insert(profiles).values({
    userId: user.id,
    username: `quota${stamp}`.slice(0, 24),
  });
  await db.insert(entitlements).values({
    userId: user.id,
    ...(quotaBytes !== undefined ? { storageQuotaBytes: quotaBytes } : {}),
  });
  createdUserIds.push(user.id);
  return user.id;
}

beforeAll(async () => {
  // Fail loudly rather than mysteriously if the stack is not running.
  await db.select().from(users).limit(1);
});

afterAll(async () => {
  for (const id of createdUserIds) {
    await db.delete(users).where(eq(users.id, id));
  }
});

describe("storage quota", () => {
  it("starts at zero and reports the entitlement quota", async () => {
    const userId = await makeUser(1000);
    const check = await checkStorageQuota(userId, 0);
    expect(check.usedBytes).toBe(0);
    expect(check.quotaBytes).toBe(1000);
    expect(check.allowed).toBe(true);
  });

  it("increments the cached counter on upload", async () => {
    const userId = await makeUser(1000);
    await recordUpload({
      userId,
      bucket: "assets",
      objectKey: `${userId}/a.png`,
      mimeType: "image/png",
      sizeBytes: 300,
    });

    const [profile] = await db
      .select({ used: profiles.storageUsedBytes })
      .from(profiles)
      .where(eq(profiles.userId, userId));
    expect(profile.used).toBe(300);
  });

  it("rejects an upload that would exceed the quota", async () => {
    const userId = await makeUser(500);
    await recordUpload({
      userId,
      bucket: "assets",
      objectKey: `${userId}/a.png`,
      mimeType: "image/png",
      sizeBytes: 400,
    });

    await expect(
      recordUpload({
        userId,
        bucket: "assets",
        objectKey: `${userId}/b.png`,
        mimeType: "image/png",
        sizeBytes: 200,
      }),
    ).rejects.toThrow(QuotaExceededError);

    // The rejected upload must leave no row and no counter change.
    const rows = await db
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.userId, userId));
    expect(rows).toHaveLength(1);

    const [profile] = await db
      .select({ used: profiles.storageUsedBytes })
      .from(profiles)
      .where(eq(profiles.userId, userId));
    expect(profile.used).toBe(400);
  });

  it("allows an upload that exactly fills the quota", async () => {
    const userId = await makeUser(500);
    await expect(
      recordUpload({
        userId,
        bucket: "assets",
        objectKey: `${userId}/exact.png`,
        mimeType: "image/png",
        sizeBytes: 500,
      }),
    ).resolves.toBeTruthy();
  });

  it("decrements the counter on delete", async () => {
    const userId = await makeUser(1000);
    const file = await recordUpload({
      userId,
      bucket: "assets",
      objectKey: `${userId}/a.png`,
      mimeType: "image/png",
      sizeBytes: 300,
    });

    const removed = await deleteUpload(userId, file.id);
    expect(removed?.sizeBytes).toBe(300);

    const [profile] = await db
      .select({ used: profiles.storageUsedBytes })
      .from(profiles)
      .where(eq(profiles.userId, userId));
    expect(profile.used).toBe(0);
  });

  it("does not let one user delete another's file", async () => {
    const owner = await makeUser(1000);
    const attacker = await makeUser(1000);

    const file = await recordUpload({
      userId: owner,
      bucket: "assets",
      objectKey: `${owner}/private.png`,
      mimeType: "image/png",
      sizeBytes: 100,
    });

    // Scoped by userId, so this matches nothing rather than deleting.
    const result = await deleteUpload(attacker, file.id);
    expect(result).toBeNull();

    const rows = await db
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.id, file.id));
    expect(rows).toHaveLength(1);
  });

  it("concurrent uploads cannot both exceed the quota", async () => {
    const userId = await makeUser(500);

    // Both pass an advisory check; the row lock inside the transaction
    // must let exactly one commit.
    const results = await Promise.allSettled([
      recordUpload({
        userId,
        bucket: "assets",
        objectKey: `${userId}/race1.png`,
        mimeType: "image/png",
        sizeBytes: 400,
      }),
      recordUpload({
        userId,
        bucket: "assets",
        objectKey: `${userId}/race2.png`,
        mimeType: "image/png",
        sizeBytes: 400,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);

    const total = await recalculateStorageUsed(userId);
    expect(total).toBe(400);
  });

  it("recalculate repairs a drifted counter", async () => {
    const userId = await makeUser(1000);
    await recordUpload({
      userId,
      bucket: "assets",
      objectKey: `${userId}/a.png`,
      mimeType: "image/png",
      sizeBytes: 250,
    });

    // Simulate drift from a write that bypassed the helpers.
    await db
      .update(profiles)
      .set({ storageUsedBytes: 999 })
      .where(eq(profiles.userId, userId));

    expect(await recalculateStorageUsed(userId)).toBe(250);
  });
});

describe("votes", () => {
  it("counts net score", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const target = `scenario-${Date.now()}`;

    await castVote({ userId: a, targetType: "scenario", targetId: target, value: 1 });
    await castVote({ userId: b, targetType: "scenario", targetId: target, value: 1 });
    expect(await getVoteCount("scenario", target)).toBe(2);

    await castVote({ userId: b, targetType: "scenario", targetId: target, value: -1 });
    expect(await getVoteCount("scenario", target)).toBe(0);
  });

  it("is idempotent per user", async () => {
    const userId = await makeUser();
    const target = `scenario-${Date.now()}-idem`;

    await castVote({ userId, targetType: "scenario", targetId: target, value: 1 });
    await castVote({ userId, targetType: "scenario", targetId: target, value: 1 });
    await castVote({ userId, targetType: "scenario", targetId: target, value: 1 });

    // Three casts, one row, score of 1 — not 3.
    expect(await getVoteCount("scenario", target)).toBe(1);
    const rows = await db.select().from(votes).where(eq(votes.targetId, target));
    expect(rows).toHaveLength(1);
  });

  it("clears a vote", async () => {
    const userId = await makeUser();
    const target = `scenario-${Date.now()}-clear`;
    await castVote({ userId, targetType: "scenario", targetId: target, value: 1 });
    expect(await clearVote({ userId, targetType: "scenario", targetId: target })).toBe(
      0,
    );
  });

  it("batch counts avoid N+1 and include zeroes", async () => {
    const userId = await makeUser();
    const t1 = `scenario-${Date.now()}-b1`;
    const t2 = `scenario-${Date.now()}-b2`;
    const t3 = `scenario-${Date.now()}-b3`;

    await castVote({ userId, targetType: "scenario", targetId: t1, value: 1 });
    await castVote({ userId, targetType: "scenario", targetId: t2, value: -1 });

    const counts = await getVoteCounts("scenario", [t1, t2, t3]);
    expect(counts.get(t1)).toBe(1);
    expect(counts.get(t2)).toBe(-1);
    // Never voted on: must be present as 0, not missing.
    expect(counts.get(t3)).toBe(0);
  });

  it("keeps votes on different target types separate", async () => {
    const userId = await makeUser();
    const id = `shared-id-${Date.now()}`;

    await castVote({ userId, targetType: "scenario", targetId: id, value: 1 });
    await castVote({ userId, targetType: "campaign", targetId: id, value: -1 });

    // Same id under two types must not collide.
    expect(await getVoteCount("scenario", id)).toBe(1);
    expect(await getVoteCount("campaign", id)).toBe(-1);
  });
});
