"use client";

import * as React from "react";
import { Plus, X, Save, Send } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

/**
 * Scenario creation form — presentational shell.
 * Wire to Zod validation + createScenario server action in Phase 4.
 */
export default function NewScenarioPage() {
  const [tags, setTags] = React.useState<string[]>(["Objective"]);
  const [tagDraft, setTagDraft] = React.useState("");
  const [sections, setSections] = React.useState<number[]>([0]);

  function addTag(e: React.FormEvent) {
    e.preventDefault();
    const t = tagDraft.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagDraft("");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-faint">
            New // Scenario
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-tight text-ink">
            Forge a scenario
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <Save className="size-4" /> Draft
          </Button>
          <Button size="sm">
            <Send className="size-4" /> Publish
          </Button>
        </div>
      </header>

      <Tabs defaultValue="basic" className="mt-8">
        <TabsList>
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="story">Story</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="events">Event Tables</TabsTrigger>
          <TabsTrigger value="publish">Publish</TabsTrigger>
        </TabsList>

        {/* Basic info */}
        <TabsContent value="basic" className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="The Mud and the Hymn" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="desc">Short description</Label>
            <Textarea
              id="desc"
              placeholder="One or two lines that appear on the browse card."
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="system">Game system</Label>
              <select
                id="system"
                className="h-10 rounded-[var(--radius-md)] border border-border-strong bg-bg px-3 text-sm text-ink focus:border-primary focus:outline-none"
              >
                <option>Trench Crusade</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Player count</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  defaultValue={2}
                  aria-label="Minimum players"
                />
                <span className="text-faint">–</span>
                <Input
                  type="number"
                  min={1}
                  defaultValue={2}
                  aria-label="Maximum players"
                />
              </div>
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
            </div>
            <form onSubmit={addTag} className="mt-2 flex gap-2">
              <Input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                placeholder="Add a tag…"
                className="max-w-48"
              />
              <Button type="submit" variant="outline" size="md">
                <Plus className="size-4" /> Add
              </Button>
            </form>
          </div>
        </TabsContent>

        {/* Story */}
        <TabsContent value="story" className="flex flex-col gap-3">
          <Label htmlFor="story">Briefing</Label>
          <Textarea
            id="story"
            className="min-h-64"
            placeholder="Set the scene. A rich-text editor (Tiptap) replaces this in Phase 4."
          />
          <p className="font-mono text-xs text-faint">
            Rich-text formatting toolbar arrives with the Tiptap editor.
          </p>
        </TabsContent>

        {/* Sections */}
        <TabsContent value="sections" className="flex flex-col gap-4">
          {sections.map((id, i) => (
            <Card key={id} className="p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wider text-primary">
                  Section {i + 1}
                </span>
                {sections.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSections(sections.filter((s) => s !== id))}
                    className="text-faint hover:text-danger"
                    aria-label="Remove section"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr]">
                <select className="h-10 rounded-[var(--radius-md)] border border-border-strong bg-bg px-3 text-sm text-ink focus:border-primary focus:outline-none">
                  <option>Objective</option>
                  <option>Deployment</option>
                  <option>Victory</option>
                  <option>Special Rules</option>
                </select>
                <Input placeholder="Section title" />
              </div>
              <Textarea className="mt-3" placeholder="Section content…" />
            </Card>
          ))}
          <Button
            variant="outline"
            onClick={() => setSections([...sections, Date.now()])}
            className="self-start"
          >
            <Plus className="size-4" /> Add section
          </Button>
        </TabsContent>

        {/* Event tables */}
        <TabsContent value="events">
          <Card className="p-6 text-center">
            <p className="text-muted">
              Build roll-driven event tables here — add rows of roll range, effect, and
              description.
            </p>
            <Button variant="outline" className="mt-4">
              <Plus className="size-4" /> New event table
            </Button>
          </Card>
        </TabsContent>

        {/* Publish */}
        <TabsContent value="publish" className="flex flex-col gap-4">
          <Card className="p-6">
            <h2 className="font-display text-lg font-semibold text-ink">
              Ready to deploy?
            </h2>
            <p className="mt-2 text-sm text-muted">
              Review your scenario, then publish it to the archive or save it as a
              private draft.
            </p>
            <div className="mt-5 flex gap-2">
              <Button>
                <Send className="size-4" /> Publish to archive
              </Button>
              <Button variant="secondary">
                <Save className="size-4" /> Save draft
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
