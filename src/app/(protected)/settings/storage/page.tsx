import type { Metadata } from "next";
import { FileImage, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Storage" };

// Placeholder — real usage from profiles.total_storage_used_bytes (Phase 2/7).
const QUOTA_MB = 50;
const USED_MB = 18.4;
const FILES = [
  {
    name: "flooded-chapel.png",
    size: "4.2 MB",
    scenario: "The Mud and the Hymn",
    date: "3 days ago",
  },
  {
    name: "no-mans-land-ref.jpg",
    size: "3.1 MB",
    scenario: "No Man's Vigil",
    date: "1 week ago",
  },
  {
    name: "trench-network.webp",
    size: "6.8 MB",
    scenario: "Verdun in Miniature",
    date: "2 weeks ago",
  },
  {
    name: "confessional-map.png",
    size: "4.3 MB",
    scenario: "The Iron Confessional",
    date: "3 weeks ago",
  },
];

export default function StorageSettingsPage() {
  const pct = Math.round((USED_MB / QUOTA_MB) * 100);

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Storage</h2>
            <p className="mt-1 text-sm text-muted">
              Uploaded map assets count against your quota.
            </p>
          </div>
          <p className="font-mono text-sm text-muted">
            <span className="text-ink">{USED_MB} MB</span> / {QUOTA_MB} MB
          </p>
        </div>

        {/* Usage meter */}
        <div className="mt-4">
          <div className="h-2.5 overflow-hidden rounded-full bg-elevated">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-[var(--ease-out-expo)]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-faint">
            {pct}% used
          </p>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <h2 className="border-b border-border px-6 py-4 font-mono text-xs font-semibold uppercase tracking-wider text-faint">
          Uploaded files
        </h2>
        <ul>
          {FILES.map((file) => (
            <li
              key={file.name}
              className="flex items-center gap-4 border-b border-border px-6 py-3.5 last:border-0"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-border bg-elevated text-muted">
                <FileImage className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{file.name}</p>
                <p className="truncate font-mono text-[0.6875rem] uppercase tracking-wider text-faint">
                  {file.scenario} · {file.date}
                </p>
              </div>
              <span className="shrink-0 font-mono text-xs text-muted">{file.size}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${file.name}`}
                className="shrink-0 hover:text-danger"
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
