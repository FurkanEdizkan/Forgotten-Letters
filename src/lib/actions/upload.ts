"use server";

/**
 * Upload flow.
 *
 * Two steps: request a presigned URL (validated, quota-checked), then
 * confirm once the browser has PUT the bytes. Splitting them keeps file
 * data off the app server entirely.
 *
 * The presign is the authorization boundary — content type and length
 * are bound into the signature, so a client cannot upload a different
 * type or a larger body than was approved. Everything validated here
 * must therefore be validated *before* the URL is issued, not after.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { uploadedFiles } from "@/lib/db/schema";
import {
  QuotaExceededError,
  checkStorageQuota,
  deleteUpload,
  recordUpload,
} from "@/lib/db/storage-quota";
import { getUploadUrl, deleteObject } from "@/lib/storage/r2";
import {
  applyUploadPolicy,
  buildObjectKey,
  isKnownBucket,
  ownsObjectKey,
  type UploadKind,
} from "@/lib/storage/upload-policy";

export type { UploadKind };

const requestSchema = z.object({
  kind: z.enum(["assets", "avatars"]),
  contentType: z.string().min(1),
  contentLength: z.number().int().positive(),
});

export type UploadTicket = {
  uploadUrl: string;
  bucket: string;
  objectKey: string;
};

export type UploadResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function requestUploadUrlAction(input: {
  kind: UploadKind;
  contentType: string;
  contentLength: number;
}): Promise<UploadResult<UploadTicket>> {
  const user = await requireUser();

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid upload request." };
  }
  const { kind, contentType, contentLength } = parsed.data;

  const policy = applyUploadPolicy({ kind, contentType, contentLength });
  if (!policy.ok) {
    return { ok: false, error: policy.error };
  }

  const quota = await checkStorageQuota(user.id, contentLength);
  if (!quota.allowed) {
    const remainingMb = (quota.remainingBytes / 1024 / 1024).toFixed(1);
    return {
      ok: false,
      error: `Not enough storage left — ${remainingMb} MB free. Delete something or upgrade.`,
    };
  }

  const objectKey = buildObjectKey(user.id, randomUUID(), policy.extension);

  const uploadUrl = await getUploadUrl({
    bucket: policy.bucket,
    key: objectKey,
    contentType,
    contentLength,
  });

  return { ok: true, data: { uploadUrl, bucket: policy.bucket, objectKey } };
}

/**
 * Record an upload after the browser has PUT it.
 *
 * Re-verifies quota inside a transaction, so two uploads racing through
 * the advisory check cannot both land. If the row cannot be written the
 * object is removed from storage rather than left orphaned and unbilled.
 */
export async function confirmUploadAction(input: {
  bucket: string;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  isTemporary?: boolean;
}): Promise<UploadResult<{ fileId: string }>> {
  const user = await requireUser();

  // The key is server-generated as `${userId}/...`; anything else is a
  // client claiming an object it was never issued.
  if (!ownsObjectKey(user.id, input.objectKey) || !isKnownBucket(input.bucket)) {
    return { ok: false, error: "Invalid upload request." };
  }

  try {
    const file = await recordUpload({
      userId: user.id,
      bucket: input.bucket,
      objectKey: input.objectKey,
      mimeType: input.contentType,
      sizeBytes: input.sizeBytes,
      isTemporary: input.isTemporary,
    });
    return { ok: true, data: { fileId: file.id } };
  } catch (error) {
    // Bytes are already in storage but unaccounted for; remove them so
    // they cannot accumulate outside the quota system.
    await deleteObject(input.bucket, input.objectKey).catch(() => {});

    if (error instanceof QuotaExceededError) {
      return { ok: false, error: "Storage quota exceeded." };
    }
    throw error;
  }
}

/** Delete an upload the caller owns, from both the database and storage. */
export async function deleteUploadAction(
  fileId: string,
): Promise<UploadResult<{ freedBytes: number }>> {
  const user = await requireUser();

  const [file] = await db
    .select()
    .from(uploadedFiles)
    .where(eq(uploadedFiles.id, fileId))
    .limit(1);

  // Same message whether it is missing or someone else's — telling them
  // apart confirms which ids exist.
  if (!file || file.userId !== user.id) {
    return { ok: false, error: "Not found." };
  }

  const removed = await deleteUpload(user.id, fileId);
  if (!removed) return { ok: false, error: "Not found." };

  // Storage delete is best-effort: the quota is already freed, and a
  // failure here leaves a harmless orphan for the cleanup task.
  await deleteObject(removed.bucket, removed.objectKey).catch(() => {});

  return { ok: true, data: { freedBytes: removed.sizeBytes } };
}
