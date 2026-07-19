"use client";

/**
 * Scenario editor.
 *
 * Serves both /scenarios/new and /scenarios/[slug]/edit — the only
 * difference is whether an existing scenario is passed in, which decides
 * create vs update. Keeping one component means the two routes cannot
 * drift apart.
 *
 * State is held here and submitted as one document. The update action
 * replaces sections and event tables wholesale, so partial saves are not
 * a concern; the editor always sends the whole thing.
 *
 * Note: the 18-prototype design bundle that docs/UI-Surfaces.md names as
 * the visual source of truth is not present in this repository. This is
 * built from the written spec (the enumerated inspector tabs) and the
 * existing UI primitives, so it is functionally complete but not a
 * faithful reproduction of that design.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Save, Send, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Textarea";
import {
  createScenarioAction,
  deleteScenarioAction,
  setScenarioPublishedAction,
  updateScenarioAction,
} from "@/lib/actions/scenario";
import { SECTION_TYPES, slugify } from "@/lib/validations/scenario";

export type GameSystemOption = { id: string; name: string };

export type EditorSection = {
  type: (typeof SECTION_TYPES)[number];
  heading: string;
  body: string;
};

export type EditorEventTable = {
  title: string;
  diceNotation: string;
  entries: { min: number; max: number; result: string }[];
};

export type EditorScenario = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  gameSystemId: string;
  playerCount: number | null;
  estimatedMinutes: number | null;
  tags: string[];
  isPublished: boolean;
  sections: EditorSection[];
  eventTables: EditorEventTable[];
};

const SECTION_LABELS: Record<(typeof SECTION_TYPES)[number], string> = {
  narrative: "Narrative",
  objectives: "Objectives",
  deployment: "Deployment",
  special_rules: "Special rules",
  victory_conditions: "Victory conditions",
  event_table: "Event table",
  aftermath: "Aftermath",
};

export function ScenarioEditor({
  systems,
  scenario,
}: {
  systems: GameSystemOption[];
  scenario?: EditorScenario;
}) {
  const router = useRouter();
  const isEdit = Boolean(scenario);

  const [title, setTitle] = useState(scenario?.title ?? "");
  // Tracks whether the user has typed their own slug. Until they do, the
  // slug follows the title; after, it stays put so editing the title
  // does not silently change a published URL.
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [slug, setSlug] = useState(scenario?.slug ?? "");
  const [summary, setSummary] = useState(scenario?.summary ?? "");
  const [gameSystemId, setGameSystemId] = useState(
    scenario?.gameSystemId ?? systems[0]?.id ?? "",
  );
  const [playerCount, setPlayerCount] = useState<string>(
    scenario?.playerCount?.toString() ?? "2",
  );
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>(
    scenario?.estimatedMinutes?.toString() ?? "90",
  );
  const [tags, setTags] = useState<string[]>(scenario?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [sections, setSections] = useState<EditorSection[]>(
    scenario?.sections ?? [{ type: "narrative", heading: "", body: "" }],
  );
  const [eventTables, setEventTables] = useState<EditorEventTable[]>(
    scenario?.eventTables ?? [],
  );

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function addTag(e: React.FormEvent) {
    e.preventDefault();
    const t = tagDraft.trim().toLowerCase();
    if (t && !tags.includes(t) && tags.length < 10) setTags([...tags, t]);
    setTagDraft("");
  }

  function payload() {
    return {
      title,
      slug: slug || slugify(title),
      summary: summary || undefined,
      gameSystemId,
      playerCount: playerCount ? Number(playerCount) : null,
      estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : null,
      tags,
      sections: sections
        // Drop rows the user added and left empty rather than failing
        // validation on them.
        .filter((s) => s.body.trim() || s.heading.trim())
        .map((s, i) => ({
          type: s.type,
          heading: s.heading || undefined,
          body: s.body || undefined,
          position: i,
        })),
      eventTables: eventTables
        .filter((t) => t.title.trim())
        .map((t, i) => ({
          title: t.title,
          diceNotation: t.diceNotation || "d6",
          entries: t.entries.filter((e) => e.result.trim()),
          position: i,
        })),
    };
  }

  function save() {
    setError(null);
    setFieldErrors({});
    setNotice(null);

    startTransition(async () => {
      const result = scenario
        ? await updateScenarioAction(scenario.id, payload())
        : await createScenarioAction(payload());

      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      if (scenario) {
        setNotice("Saved.");
        router.refresh();
      } else {
        router.push(`/scenarios/${result.data.slug}/edit`);
        router.refresh();
      }
    });
  }

  function togglePublish() {
    if (!scenario) return;
    startTransition(async () => {
      const result = await setScenarioPublishedAction(
        scenario.id,
        !scenario.isPublished,
      );
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  function remove() {
    if (!scenario) return;
    // Deleting cascades to sections and event tables, so confirm first.
    if (!window.confirm("Delete this scenario and all of its sections?")) return;
    startTransition(async () => {
      const result = await deleteScenarioAction(scenario.id);
      if (!result.ok) setError(result.error);
      else {
        router.push("/scenarios");
        router.refresh();
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-faint">
            {isEdit ? "Edit // Scenario" : "New // Scenario"}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-tight text-ink">
            {isEdit ? title || "Untitled" : "Forge a scenario"}
          </h1>
          {isEdit && (
            <Badge
              variant={scenario!.isPublished ? "neutral" : "neutral"}
              className="mt-2"
            >
              {scenario!.isPublished ? "Published" : "Draft"}
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
              {scenario!.isPublished ? "Unpublish" : "Publish"}
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

      <Tabs defaultValue="basic" className="mt-8">
        <TabsList>
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="events">Event tables</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="flex flex-col gap-5">
          <Field id="title" label="Title" error={fieldErrors.title?.[0]}>
            <Input
              id="title"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="The Mud and the Hymn"
            />
          </Field>

          <Field
            id="slug"
            label="URL slug"
            error={fieldErrors.slug?.[0]}
            hint="Lowercase letters, numbers, and hyphens. Follows the title until you edit it."
          >
            <Input
              id="slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="the-mud-and-the-hymn"
            />
          </Field>

          <Field
            id="summary"
            label="Short description"
            error={fieldErrors.summary?.[0]}
          >
            <Textarea
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="One or two lines that appear on the browse card."
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="system"
              label="Game system"
              error={fieldErrors.gameSystemId?.[0]}
            >
              <select
                id="system"
                value={gameSystemId}
                onChange={(e) => setGameSystemId(e.target.value)}
                className="h-10 w-full rounded-[var(--radius-md)] border border-border-strong bg-bg px-3 text-sm text-ink focus:border-primary focus:outline-none"
              >
                {systems.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field id="players" label="Players" error={fieldErrors.playerCount?.[0]}>
                <Input
                  id="players"
                  type="number"
                  min={1}
                  max={12}
                  value={playerCount}
                  onChange={(e) => setPlayerCount(e.target.value)}
                />
              </Field>
              <Field
                id="minutes"
                label="Minutes"
                error={fieldErrors.estimatedMinutes?.[0]}
              >
                <Input
                  id="minutes"
                  type="number"
                  min={5}
                  max={1440}
                  step={15}
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(e.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Tags</Label>
            <div className="flex flex-wrap items-center gap-2">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1">
                  <Badge variant="neutral">{tag}</Badge>
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((t) => t !== tag))}
                    className="text-faint hover:text-danger"
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              {tags.length === 0 && (
                <span className="text-xs text-faint">No tags yet.</span>
              )}
            </div>
            <form onSubmit={addTag} className="mt-2 flex gap-2">
              <Input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                placeholder="Add a tag"
                aria-label="Add a tag"
              />
              <Button type="submit" variant="secondary" size="sm">
                <Plus className="size-4" /> Add
              </Button>
            </form>
            {tags.length >= 10 && (
              <p className="text-xs text-faint">Maximum of 10 tags reached.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sections" className="flex flex-col gap-4">
          {sections.map((section, i) => (
            <Card key={i} className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <select
                  value={section.type}
                  onChange={(e) =>
                    setSections(
                      sections.map((s, j) =>
                        j === i
                          ? { ...s, type: e.target.value as EditorSection["type"] }
                          : s,
                      ),
                    )
                  }
                  aria-label={`Section ${i + 1} type`}
                  className="h-9 rounded-[var(--radius-md)] border border-border-strong bg-bg px-2 text-sm text-ink focus:border-primary focus:outline-none"
                >
                  {SECTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {SECTION_LABELS[t]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setSections(sections.filter((_, j) => j !== i))}
                  className="text-faint hover:text-danger"
                  aria-label={`Remove section ${i + 1}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <Input
                value={section.heading}
                onChange={(e) =>
                  setSections(
                    sections.map((s, j) =>
                      j === i ? { ...s, heading: e.target.value } : s,
                    ),
                  )
                }
                placeholder="Optional heading"
                aria-label={`Section ${i + 1} heading`}
              />
              <Textarea
                value={section.body}
                onChange={(e) =>
                  setSections(
                    sections.map((s, j) =>
                      j === i ? { ...s, body: e.target.value } : s,
                    ),
                  )
                }
                rows={5}
                placeholder="Write this section…"
                aria-label={`Section ${i + 1} body`}
              />
            </Card>
          ))}

          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setSections([...sections, { type: "narrative", heading: "", body: "" }])
            }
          >
            <Plus className="size-4" /> Add section
          </Button>
        </TabsContent>

        <TabsContent value="events" className="flex flex-col gap-4">
          {eventTables.length === 0 && (
            <p className="text-sm text-muted">
              No event tables. Add one for random events players roll for.
            </p>
          )}

          {eventTables.map((table, i) => (
            <Card key={i} className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-3">
                <Input
                  value={table.title}
                  onChange={(e) =>
                    setEventTables(
                      eventTables.map((t, j) =>
                        j === i ? { ...t, title: e.target.value } : t,
                      ),
                    )
                  }
                  placeholder="Table title"
                  aria-label={`Event table ${i + 1} title`}
                />
                <Input
                  value={table.diceNotation}
                  onChange={(e) =>
                    setEventTables(
                      eventTables.map((t, j) =>
                        j === i ? { ...t, diceNotation: e.target.value } : t,
                      ),
                    )
                  }
                  placeholder="d6"
                  aria-label={`Event table ${i + 1} dice`}
                  className="max-w-24"
                />
                <button
                  type="button"
                  onClick={() => setEventTables(eventTables.filter((_, j) => j !== i))}
                  className="text-faint hover:text-danger"
                  aria-label={`Remove event table ${i + 1}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              {table.entries.map((entry, k) => (
                <div key={k} className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={entry.min}
                    onChange={(e) => updateEntry(i, k, { min: Number(e.target.value) })}
                    aria-label={`Entry ${k + 1} range start`}
                    className="max-w-20"
                  />
                  <span className="text-faint">–</span>
                  <Input
                    type="number"
                    min={1}
                    value={entry.max}
                    onChange={(e) => updateEntry(i, k, { max: Number(e.target.value) })}
                    aria-label={`Entry ${k + 1} range end`}
                    className="max-w-20"
                  />
                  <Input
                    value={entry.result}
                    onChange={(e) => updateEntry(i, k, { result: e.target.value })}
                    placeholder="What happens"
                    aria-label={`Entry ${k + 1} result`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEventTables(
                        eventTables.map((t, j) =>
                          j === i
                            ? { ...t, entries: t.entries.filter((_, m) => m !== k) }
                            : t,
                        ),
                      )
                    }
                    className="text-faint hover:text-danger"
                    aria-label={`Remove entry ${k + 1}`}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}

              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setEventTables(
                    eventTables.map((t, j) =>
                      j === i
                        ? {
                            ...t,
                            entries: [
                              ...t.entries,
                              {
                                min: t.entries.length + 1,
                                max: t.entries.length + 1,
                                result: "",
                              },
                            ],
                          }
                        : t,
                    ),
                  )
                }
              >
                <Plus className="size-4" /> Add row
              </Button>
            </Card>
          ))}

          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setEventTables([
                ...eventTables,
                { title: "", diceNotation: "d6", entries: [] },
              ])
            }
          >
            <Plus className="size-4" /> Add event table
          </Button>
        </TabsContent>
      </Tabs>

      {isEdit && (
        <div className="mt-10 border-t border-border pt-6">
          <Button variant="ghost" size="sm" onClick={remove} disabled={pending}>
            <Trash2 className="size-4" /> Delete scenario
          </Button>
        </div>
      )}
    </div>
  );

  function updateEntry(
    tableIndex: number,
    entryIndex: number,
    patch: Partial<{ min: number; max: number; result: string }>,
  ) {
    setEventTables(
      eventTables.map((t, j) =>
        j === tableIndex
          ? {
              ...t,
              entries: t.entries.map((e, m) =>
                m === entryIndex ? { ...e, ...patch } : e,
              ),
            }
          : t,
      ),
    );
  }
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-primary">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-faint">{hint}</p>
      ) : null}
    </div>
  );
}
