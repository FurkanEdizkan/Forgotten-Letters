/**
 * Upload policy — what may be uploaded, and where it lands.
 *
 * Pure functions, deliberately separate from the server action so the
 * rules can be tested without a session or a database. The action is
 * then a thin wrapper: authenticate, apply policy, check quota, presign.
 */
import { buckets } from "./r2";

/** Per-kind size caps, from TODO 2.3. */
export const UPLOAD_LIMITS = {
  assets: { maxBytes: 5 * 1024 * 1024, bucket: buckets.assets },
  avatars: { maxBytes: 2 * 1024 * 1024, bucket: buckets.avatars },
} as const;

export type UploadKind = keyof typeof UPLOAD_LIMITS;

/**
 * Allowlist, not a blocklist.
 *
 * SVG is excluded on purpose: it can carry <script>, and the assets
 * bucket is publicly readable, so an SVG served from our asset domain
 * would execute in that origin.
 */
export const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type PolicyResult =
  { ok: true; bucket: string; extension: string } | { ok: false; error: string };

export function applyUploadPolicy(input: {
  kind: string;
  contentType: string;
  contentLength: number;
}): PolicyResult {
  if (!(input.kind in UPLOAD_LIMITS)) {
    return { ok: false, error: "Invalid upload request." };
  }
  const limit = UPLOAD_LIMITS[input.kind as UploadKind];

  if (!ALLOWED_MIME_TYPES.has(input.contentType)) {
    return { ok: false, error: "That file type is not allowed." };
  }

  if (!Number.isInteger(input.contentLength) || input.contentLength <= 0) {
    return { ok: false, error: "Invalid file size." };
  }

  if (input.contentLength > limit.maxBytes) {
    const mb = Math.round(limit.maxBytes / 1024 / 1024);
    return { ok: false, error: `Files must be ${mb} MB or smaller.` };
  }

  return { ok: true, bucket: limit.bucket, extension: EXTENSION[input.contentType] };
}

/**
 * Object key for an upload.
 *
 * Always server-generated and namespaced by user id. A client-supplied
 * key could target another user's prefix or overwrite their object.
 */
export function buildObjectKey(
  userId: string,
  uuid: string,
  extension: string,
): string {
  return `${userId}/${uuid}.${extension}`;
}

/** Whether a key belongs to this user — the guard on the confirm step. */
export function ownsObjectKey(userId: string, objectKey: string): boolean {
  return objectKey.startsWith(`${userId}/`);
}

/** Whether a bucket name is one we actually issue uploads for. */
export function isKnownBucket(bucket: string): boolean {
  return bucket === buckets.assets || bucket === buckets.avatars;
}
