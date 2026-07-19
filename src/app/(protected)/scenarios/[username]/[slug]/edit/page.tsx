import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";

import {
  ScenarioEditor,
  type EditorEventTable,
  type EditorSection,
} from "@/components/scenario-form/ScenarioEditor";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import {
  eventTables,
  gameSystems,
  profiles,
  scenarios,
  scenarioSections,
} from "@/lib/db/schema";

export const metadata: Metadata = { title: "Edit scenario" };

export default async function EditScenarioPage({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const user = await requireUser();
  const { username, slug } = await params;

  // Scoped to the signed-in author. Another user's scenario is a 404,
  // not a 403 — a 403 confirms it exists. The username in the URL must
  // also match, so /scenarios/alice/x/edit is not reachable by bob even
  // if bob happens to own a scenario with slug "x".
  const [scenario] = await db
    .select()
    .from(scenarios)
    .innerJoin(profiles, eq(profiles.userId, scenarios.authorId))
    .where(
      and(
        eq(scenarios.slug, slug),
        eq(scenarios.authorId, user.id),
        eq(profiles.username, username),
      ),
    )
    .limit(1)
    .then((rows) => rows.map((r) => r.scenarios));

  if (!scenario) notFound();

  const [systems, sections, tables] = await Promise.all([
    db
      .select({ id: gameSystems.id, name: gameSystems.name })
      .from(gameSystems)
      .where(eq(gameSystems.isActive, true)),
    db
      .select()
      .from(scenarioSections)
      .where(eq(scenarioSections.scenarioId, scenario.id))
      .orderBy(asc(scenarioSections.position)),
    db
      .select()
      .from(eventTables)
      .where(eq(eventTables.scenarioId, scenario.id))
      .orderBy(asc(eventTables.position)),
  ]);

  return (
    <ScenarioEditor
      systems={systems}
      username={username}
      scenario={{
        id: scenario.id,
        title: scenario.title,
        slug: scenario.slug,
        summary: scenario.summary ?? "",
        gameSystemId: scenario.gameSystemId,
        playerCount: scenario.playerCount,
        estimatedMinutes: scenario.estimatedMinutes,
        tags: scenario.tags,
        isPublished: scenario.isPublished,
        sections: sections.map((s): EditorSection => ({
          type: s.type,
          heading: s.heading ?? "",
          body: s.body ?? "",
        })),
        eventTables: tables.map((t): EditorEventTable => ({
          title: t.title,
          diceNotation: t.diceNotation,
          entries: (t.entries as EditorEventTable["entries"]) ?? [],
        })),
      }}
    />
  );
}
