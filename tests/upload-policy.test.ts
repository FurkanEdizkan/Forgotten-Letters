import { describe, expect, it } from "vitest";

import {
  ALLOWED_MIME_TYPES,
  applyUploadPolicy,
  buildObjectKey,
  isKnownBucket,
  ownsObjectKey,
} from "@/lib/storage/upload-policy";

const MB = 1024 * 1024;

describe("applyUploadPolicy", () => {
  it("accepts an allowed image within the size cap", () => {
    const r = applyUploadPolicy({
      kind: "assets",
      contentType: "image/png",
      contentLength: 1 * MB,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.extension).toBe("png");
  });

  it("rejects SVG", () => {
    // SVG can carry <script>, and the assets bucket is publicly
    // readable, so it would execute from our asset origin.
    const r = applyUploadPolicy({
      kind: "assets",
      contentType: "image/svg+xml",
      contentLength: 1024,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects types outside the allowlist", () => {
    for (const type of [
      "application/pdf",
      "text/html",
      "application/x-msdownload",
      "image/png; charset=utf-8",
    ]) {
      expect(
        applyUploadPolicy({ kind: "assets", contentType: type, contentLength: 10 }).ok,
        type,
      ).toBe(false);
    }
  });

  it("enforces the 5 MB assets cap", () => {
    expect(
      applyUploadPolicy({
        kind: "assets",
        contentType: "image/png",
        contentLength: 5 * MB,
      }).ok,
    ).toBe(true);
    expect(
      applyUploadPolicy({
        kind: "assets",
        contentType: "image/png",
        contentLength: 5 * MB + 1,
      }).ok,
    ).toBe(false);
  });

  it("enforces the tighter 2 MB avatars cap", () => {
    expect(
      applyUploadPolicy({
        kind: "avatars",
        contentType: "image/png",
        contentLength: 2 * MB,
      }).ok,
    ).toBe(true);
    // Would pass under the assets cap; must not here.
    expect(
      applyUploadPolicy({
        kind: "avatars",
        contentType: "image/png",
        contentLength: 3 * MB,
      }).ok,
    ).toBe(false);
  });

  it("rejects an unknown kind", () => {
    expect(
      applyUploadPolicy({
        kind: "backups",
        contentType: "image/png",
        contentLength: 10,
      }).ok,
    ).toBe(false);
  });

  it("rejects zero, negative, and fractional sizes", () => {
    for (const n of [0, -1, 1.5, NaN]) {
      expect(
        applyUploadPolicy({
          kind: "assets",
          contentType: "image/png",
          contentLength: n,
        }).ok,
        String(n),
      ).toBe(false);
    }
  });

  it("routes each kind to its own bucket", () => {
    const a = applyUploadPolicy({
      kind: "assets",
      contentType: "image/png",
      contentLength: 10,
    });
    const b = applyUploadPolicy({
      kind: "avatars",
      contentType: "image/png",
      contentLength: 10,
    });
    expect(a.ok && b.ok && a.bucket !== b.bucket).toBe(true);
  });
});

describe("object keys", () => {
  it("namespaces by user id", () => {
    expect(buildObjectKey("user-1", "abc", "png")).toBe("user-1/abc.png");
  });

  it("recognizes a key the user owns", () => {
    expect(ownsObjectKey("user-1", "user-1/abc.png")).toBe(true);
  });

  it("rejects another user's prefix", () => {
    expect(ownsObjectKey("user-1", "user-2/abc.png")).toBe(false);
  });

  it("rejects a prefix that merely starts with the id", () => {
    // "user-1" must not match "user-10/..." — the separator matters.
    expect(ownsObjectKey("user-1", "user-10/abc.png")).toBe(false);
  });

  it("rejects traversal attempts", () => {
    expect(ownsObjectKey("user-1", "../user-2/abc.png")).toBe(false);
  });
});

describe("isKnownBucket", () => {
  it("rejects an arbitrary bucket name", () => {
    expect(isKnownBucket("some-other-bucket")).toBe(false);
  });
});

describe("ALLOWED_MIME_TYPES", () => {
  it("contains only raster image types", () => {
    for (const t of ALLOWED_MIME_TYPES) {
      expect(t.startsWith("image/")).toBe(true);
      expect(t).not.toContain("svg");
    }
  });
});
