import type { Metadata } from "next";
import { FileImage } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { requireUser } from "@/lib/auth/guards";
import { formatBytes, getStorageUsage } from "@/lib/queries/storage";

export const metadata: Metadata = { title: "Storage" };

export default async function StorageSettingsPage() {
  const user = await requireUser();
  const usage = await getStorageUsage(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl text-ink">Storage</h2>
        <p className="mt-1 text-sm text-muted">
          {formatBytes(usage.usedBytes)} of {formatBytes(usage.quotaBytes)} used.
        </p>
      </div>

      <div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-elevated"
          role="progressbar"
          aria-valuenow={Math.round(usage.percentUsed)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Storage used"
        >
          <div
            className={
              usage.percentUsed > 90
                ? "h-full bg-danger"
                : usage.percentUsed > 70
                  ? "h-full bg-warning"
                  : "h-full bg-primary"
            }
            style={{ width: `${usage.percentUsed}%` }}
          />
        </div>
        <p className="mt-1.5 font-mono text-xs text-faint">
          {usage.percentUsed.toFixed(1)}% used
        </p>
      </div>

      <div>
        <h3 className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-accent">
          Files
        </h3>

        {usage.files.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No uploads yet. Images attached to scenarios appear here.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {usage.files.map((file) => (
              <Card key={file.id} className="flex items-center gap-3 p-3">
                <FileImage className="size-4 shrink-0 text-faint" />
                <span className="flex-1 truncate font-mono text-xs text-muted">
                  {/* Keys are namespaced by user id; show only the filename. */}
                  {file.objectKey.split("/").pop()}
                </span>
                <span className="shrink-0 font-mono text-xs text-faint">
                  {formatBytes(file.sizeBytes)}
                </span>
                <span className="hidden shrink-0 font-mono text-xs text-faint sm:inline">
                  {new Date(file.createdAt).toLocaleDateString()}
                </span>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
