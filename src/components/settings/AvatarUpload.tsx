"use client";

/**
 * Avatar upload.
 *
 * Three steps, matching the presigned flow in lib/actions/upload.ts:
 *   1. ask the server for a presigned PUT (validated + quota-checked)
 *   2. PUT the bytes straight to storage, never through the app server
 *   3. confirm, so the row is written and quota accounted
 *
 * Client-side type and size checks here are convenience only — the
 * server re-validates both, and the presign binds content type and
 * length into the signature.
 */
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Upload } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { setAvatarAction } from "@/lib/actions/profile";
import { confirmUploadAction, requestUploadUrlAction } from "@/lib/actions/upload";

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function AvatarUpload({
  name,
  currentUrl,
}: {
  name: string;
  currentUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Shows the new image immediately; the server round-trip follows.
  const [preview, setPreview] = useState<string | null>(null);

  function onPick(file: File) {
    setError(null);
    setNotice(null);

    if (!ACCEPTED.includes(file.type)) {
      setError("Use a PNG, JPEG, WebP, or GIF image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Avatars must be 2 MB or smaller.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    startTransition(async () => {
      const ticket = await requestUploadUrlAction({
        kind: "avatars",
        contentType: file.type,
        contentLength: file.size,
      });

      if (!ticket.ok) {
        setError(ticket.error);
        setPreview(null);
        URL.revokeObjectURL(objectUrl);
        return;
      }

      // Straight to storage. Headers must match what was signed.
      const put = await fetch(ticket.data.uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "content-type": file.type,
          "content-length": String(file.size),
        },
      }).catch(() => null);

      if (!put || !put.ok) {
        setError("Upload failed. Try again.");
        setPreview(null);
        URL.revokeObjectURL(objectUrl);
        return;
      }

      const confirmed = await confirmUploadAction({
        bucket: ticket.data.bucket,
        objectKey: ticket.data.objectKey,
        contentType: file.type,
        sizeBytes: file.size,
      });

      if (!confirmed.ok) {
        setError(confirmed.error);
        setPreview(null);
        URL.revokeObjectURL(objectUrl);
        return;
      }

      const applied = await setAvatarAction({
        bucket: ticket.data.bucket,
        objectKey: ticket.data.objectKey,
      });

      if (!applied.ok) {
        setError(applied.error);
        setPreview(null);
        URL.revokeObjectURL(objectUrl);
        return;
      }

      // Release the blob and drop back to the server-rendered URL.
      // Leaving the preview in place leaks the object URL for the life
      // of the page and hides whether the real URL actually resolves.
      URL.revokeObjectURL(objectUrl);
      setPreview(null);
      setNotice("Avatar updated.");
      router.refresh();
    });
  }

  const shown = preview ?? currentUrl;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        {shown ? (
          // Avatars live on a different origin (MinIO locally, R2 in
          // prod), so unoptimized avoids the image loader needing that
          // host allowlisted in next.config.
          <Image
            src={shown}
            alt="Your avatar"
            width={64}
            height={64}
            unoptimized
            className="size-16 rounded-full border border-border object-cover"
          />
        ) : (
          <Avatar name={name} size="lg" />
        )}

        <div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="sr-only"
            aria-label="Choose an avatar image"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onPick(file);
              // Reset so re-picking the same file fires onChange again.
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" />
            {pending ? "Uploading…" : "Change avatar"}
          </Button>
          <p className="mt-1.5 text-xs text-faint">
            PNG, JPEG, WebP, or GIF. Max 2 MB.
          </p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded border border-primary/40 bg-primary-soft px-3 py-2 text-sm text-primary-ink"
        >
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded border border-border bg-elevated px-3 py-2 text-sm text-ink">
          {notice}
        </p>
      )}
    </div>
  );
}
