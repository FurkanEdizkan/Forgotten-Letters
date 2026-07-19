"use client";

/**
 * Campaign editor — metadata only.
 *
 * The node-graph canvas is a separate surface that depends on the design
 * bundle referenced in docs/UI-Surfaces.md, which is not present in this
 * repository. The graph itself is fully modelled: validated
 * (validations/campaign.ts), persisted (saveCampaignGraphAction), and
 * rendered read-only as an outline on the campaign detail page. What is
 * missing is the drag-and-drop editing surface, not the data layer.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Save, Send, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import {
  createCampaignAction,
  deleteCampaignAction,
  setCampaignPublishedAction,
  updateCampaignAction,
} from "@/lib/actions/campaign";
import { slugify } from "@/lib/validations/campaign";

export type CampaignSystemOption = { id: string; name: string };

export type EditorCampaign = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  gameSystemId: string;
  isPublished: boolean;
};

export function CampaignEditor({
  systems,
  username,
  campaign,
}: {
  systems: CampaignSystemOption[];
  username: string;
  campaign?: EditorCampaign;
}) {
  const router = useRouter();
  const isEdit = Boolean(campaign);

  const [title, setTitle] = useState(campaign?.title ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [slug, setSlug] = useState(campaign?.slug ?? "");
  const [summary, setSummary] = useState(campaign?.summary ?? "");
  const [gameSystemId, setGameSystemId] = useState(
    campaign?.gameSystemId ?? systems[0]?.id ?? "",
  );

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function payload() {
    return {
      title,
      slug: slug || slugify(title),
      summary: summary || undefined,
      gameSystemId,
    };
  }

  function save() {
    setError(null);
    setFieldErrors({});
    setNotice(null);
    startTransition(async () => {
      const result = campaign
        ? await updateCampaignAction(campaign.id, payload())
        : await createCampaignAction(payload());

      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      if (campaign) {
        setNotice("Saved.");
        router.refresh();
      } else {
        router.push(`/campaigns/${username}/${result.data.slug}/edit`);
        router.refresh();
      }
    });
  }

  function togglePublish() {
    if (!campaign) return;
    startTransition(async () => {
      const result = await setCampaignPublishedAction(
        campaign.id,
        !campaign.isPublished,
      );
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  function remove() {
    if (!campaign) return;
    // Scenarios survive (the FK is ON DELETE SET NULL). Say so, rather
    // than letting the user assume this destroys their work.
    if (
      !window.confirm(
        "Delete this campaign? Linked scenarios are kept and become standalone.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteCampaignAction(campaign.id);
      if (!result.ok) setError(result.error);
      else {
        router.push("/campaigns");
        router.refresh();
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-faint">
            {isEdit ? "Edit // Campaign" : "New // Campaign"}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-tight text-ink">
            {isEdit ? title || "Untitled" : "Begin a campaign"}
          </h1>
          {isEdit && (
            <Badge variant="neutral" className="mt-2">
              {campaign!.isPublished ? "Published" : "Draft"}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={save} disabled={pending}>
            <Save className="size-4" /> {pending ? "Saving…" : "Save"}
          </Button>
          {isEdit && (
            <Button size="sm" onClick={togglePublish} disabled={pending}>
              <Send className="size-4" />
              {campaign!.isPublished ? "Unpublish" : "Publish"}
            </Button>
          )}
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded border border-primary/40 bg-primary-soft px-3 py-2 text-sm text-primary-ink"
        >
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-4 rounded border border-border bg-elevated px-3 py-2 text-sm text-ink">
          {notice}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            placeholder="The Long Retreat"
          />
          {fieldErrors.title && (
            <p id="title-error" className="text-xs text-primary">
              {fieldErrors.title[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slug">URL slug</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            placeholder="the-long-retreat"
          />
          {fieldErrors.slug ? (
            <p id="slug-error" className="text-xs text-primary">
              {fieldErrors.slug[0]}
            </p>
          ) : (
            <p className="text-xs text-faint">Follows the title until you edit it.</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="summary">Summary</Label>
          <Textarea
            id="summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="What is this campaign about?"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="system">Game system</Label>
          <select
            id="system"
            value={gameSystemId}
            onChange={(e) => setGameSystemId(e.target.value)}
            className="h-10 rounded-[var(--radius-md)] border border-border-strong bg-bg px-3 text-sm text-ink focus:border-primary focus:outline-none"
          >
            {systems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isEdit && (
        <div className="mt-10 border-t border-border pt-6">
          <Button variant="ghost" size="sm" onClick={remove} disabled={pending}>
            <Trash2 className="size-4" /> Delete campaign
          </Button>
        </div>
      )}
    </div>
  );
}
