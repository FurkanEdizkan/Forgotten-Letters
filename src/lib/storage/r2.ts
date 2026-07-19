/**
 * S3-compatible object storage.
 *
 * One client for both environments: MinIO locally, Cloudflare R2 in prod.
 * The only differences are R2_ENDPOINT and R2_FORCE_PATH_STYLE — MinIO
 * addresses buckets as a path segment (host/bucket/key) while R2 uses
 * virtual-host style (bucket.host/key). See docs/BuildPlan.md §A3.
 *
 * Uploads go through presigned PUT URLs so file bytes never transit the
 * app server. Callers MUST still validate size, MIME type, and the user's
 * quota before issuing a URL — the presign itself grants write access.
 */
import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/lib/env";

/** Presigned URLs expire fast — they are handed out per upload action. */
const PRESIGN_TTL_SECONDS = 300;

export const s3 = new S3Client({
  region: env.R2_REGION,
  endpoint: env.R2_ENDPOINT,
  forcePathStyle: env.R2_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

export const buckets = {
  assets: env.R2_BUCKET_ASSETS,
  avatars: env.R2_BUCKET_AVATARS,
} as const;

export type BucketName = (typeof buckets)[keyof typeof buckets];

/**
 * Presigned PUT for a browser upload.
 *
 * `contentType` and `contentLength` are bound into the signature, so the
 * client cannot upload a different type or a larger body than was
 * authorized — this is the enforcement point, not a hint.
 */
export async function getUploadUrl(opts: {
  bucket: BucketName;
  key: string;
  contentType: string;
  contentLength: number;
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: opts.bucket,
    Key: opts.key,
    ContentType: opts.contentType,
    ContentLength: opts.contentLength,
  });
  return getSignedUrl(s3, command, { expiresIn: PRESIGN_TTL_SECONDS });
}

/** Presigned GET, for private objects such as avatars. */
export async function getDownloadUrl(opts: {
  bucket: BucketName;
  key: string;
}): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: opts.bucket,
    Key: opts.key,
  });
  return getSignedUrl(s3, command, { expiresIn: PRESIGN_TTL_SECONDS });
}

/**
 * Public URL for an object in the assets bucket.
 *
 * Assets are served directly (via the Cloudflare custom domain in prod,
 * MinIO's public bucket locally) rather than presigned, so they can be
 * cached by the CDN.
 */
export function getPublicAssetUrl(key: string): string {
  const base = process.env.NEXT_PUBLIC_ASSET_BASE_URL!.replace(/\/$/, "");
  return `${base}/${key.replace(/^\//, "")}`;
}

/** Liveness probe for /api/health. Returns false rather than throwing. */
export async function pingStorage(): Promise<boolean> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: buckets.assets }));
    return true;
  } catch {
    return false;
  }
}
