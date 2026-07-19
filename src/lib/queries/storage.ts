/**
 * Storage usage for the settings dashboard. Server-only.
 */
import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { entitlements, profiles, uploadedFiles } from "@/lib/db/schema";

export type StorageUsage = {
  usedBytes: number;
  quotaBytes: number;
  percentUsed: number;
  files: {
    id: string;
    objectKey: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
  }[];
};

export async function getStorageUsage(userId: string): Promise<StorageUsage> {
  const [[profile], [ent], files] = await Promise.all([
    db
      .select({ used: profiles.storageUsedBytes })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1),
    db
      .select({ quota: entitlements.storageQuotaBytes })
      .from(entitlements)
      .where(eq(entitlements.userId, userId))
      .limit(1),
    db
      .select({
        id: uploadedFiles.id,
        objectKey: uploadedFiles.objectKey,
        mimeType: uploadedFiles.mimeType,
        sizeBytes: uploadedFiles.sizeBytes,
        createdAt: uploadedFiles.createdAt,
      })
      .from(uploadedFiles)
      .where(eq(uploadedFiles.userId, userId))
      .orderBy(desc(uploadedFiles.createdAt))
      .limit(200),
  ]);

  const usedBytes = profile?.used ?? 0;
  const quotaBytes = ent?.quota ?? 0;

  return {
    usedBytes,
    quotaBytes,
    // Guard the divide: a missing entitlements row would otherwise
    // produce NaN and render as "NaN% used".
    percentUsed: quotaBytes > 0 ? Math.min(100, (usedBytes / quotaBytes) * 100) : 0,
    files,
  };
}

/** Human-readable size. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
