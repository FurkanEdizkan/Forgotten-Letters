"use server";

/**
 * Scenario CRUD.
 *
 * Every mutating action re-reads ownership from the database and checks
 * it before writing. The client's claim about what it owns is never
 * trusted — Supabase RLS is gone, so this is the only enforcement point
 * (docs/Architecture.md, old→new mapping).
 *
 * "Not found" is returned for both a missing scenario and someone
 * else's: distinguishing them confirms which ids exist.
 */
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { eventTables, scenarios, scenarioSections } from "@/lib/db/schema";
import { sanitizeRichText, stripHtml } from "@/lib/sanitize";
import { scenarioSchema, slugify } from "@/lib/validations/scenario";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Parse a scenario payload, sanitizing every rich-text field. */
function parseScenario(raw: unknown) {
  const parsed = scenarioSchema.safeParse(raw);
  if (!parsed.success) return parsed;

  // Sanitize on write. Section bodies are rendered as HTML later, and
  // sanitizing at render means one forgotten call is stored XSS.
  parsed.data.sections = parsed.data.sections.map((s) => ({
    ...s,
    body: s.body ? sanitizeRichText(s.body) : undefined,
  }));
  if (parsed.data.summary) {
    // Summaries appear in meta tags and cards, so they carry no markup.
    parsed.data.summary = stripHtml(parsed.data.summary);
  }
  return parsed;
}

/**
 * Find a free slug for this author.
 *
 * Slugs are unique per author, so a collision only needs resolving
 * against that author's own scenarios.
 */
async function uniqueSlug(
  authorId: string,
  desired: string,
  excludeId?: string,
): Promise<string> {
  let candidate = desired;
  for (let n = 2; n < 100; n++) {
    const [clash] = await db
      .select({ id: scenarios.id })
      .from(scenarios)
      .where(and(eq(scenarios.authorId, authorId), eq(scenarios.slug, candidate)))
      .limit(1);

    if (!clash || clash.id === excludeId) return candidate;
    candidate = `${desired}-${n}`.slice(0, 80).replace(/-+$/g, "");
  }
  // Fall back to something guaranteed unique rather than looping forever.
  return `${desired}-${Date.now()}`.slice(0, 80);
}

export async function createScenarioAction(
  raw: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const user = await requireUser();

  const parsed = parseScenario(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const input = parsed.data;
  const slug = await uniqueSlug(user.id, input.slug || slugify(input.title));

  const created = await db.transaction(async (tx) => {
    const [scenario] = await tx
      .insert(scenarios)
      .values({
        authorId: user.id,
        gameSystemId: input.gameSystemId,
        campaignId: input.campaignId ?? null,
        slug,
        title: input.title,
        summary: input.summary,
        playerCount: input.playerCount ?? null,
        estimatedMinutes: input.estimatedMinutes ?? null,
        tags: input.tags,
        // New scenarios start unpublished; publishing is a separate,
        // deliberate action.
        isPublished: false,
      })
      .returning();

    if (input.sections.length) {
      await tx
        .insert(scenarioSections)
        .values(input.sections.map((s) => ({ ...s, scenarioId: scenario.id })));
    }
    if (input.eventTables.length) {
      await tx
        .insert(eventTables)
        .values(input.eventTables.map((t) => ({ ...t, scenarioId: scenario.id })));
    }
    return scenario;
  });

  revalidatePath("/scenarios");
  return { ok: true, data: { id: created.id, slug: created.slug } };
}

export async function updateScenarioAction(
  scenarioId: string,
  raw: unknown,
): Promise<ActionResult<{ slug: string }>> {
  const user = await requireUser();

  const [existing] = await db
    .select()
    .from(scenarios)
    .where(eq(scenarios.id, scenarioId))
    .limit(1);

  if (!existing || existing.authorId !== user.id) {
    return { ok: false, error: "Not found." };
  }

  const parsed = parseScenario(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const input = parsed.data;
  const slug = await uniqueSlug(
    user.id,
    input.slug || slugify(input.title),
    scenarioId,
  );

  await db.transaction(async (tx) => {
    await tx
      .update(scenarios)
      .set({
        gameSystemId: input.gameSystemId,
        campaignId: input.campaignId ?? null,
        slug,
        title: input.title,
        summary: input.summary,
        playerCount: input.playerCount ?? null,
        estimatedMinutes: input.estimatedMinutes ?? null,
        tags: input.tags,
        updatedAt: new Date(),
      })
      .where(eq(scenarios.id, scenarioId));

    // Sections and tables are replaced wholesale: the editor sends the
    // full document, and diffing positions server-side would be more
    // code for no behavioural gain.
    await tx
      .delete(scenarioSections)
      .where(eq(scenarioSections.scenarioId, scenarioId));
    await tx.delete(eventTables).where(eq(eventTables.scenarioId, scenarioId));

    if (input.sections.length) {
      await tx
        .insert(scenarioSections)
        .values(input.sections.map((s) => ({ ...s, scenarioId })));
    }
    if (input.eventTables.length) {
      await tx
        .insert(eventTables)
        .values(input.eventTables.map((t) => ({ ...t, scenarioId })));
    }
  });

  revalidatePath(`/scenarios/${slug}`);
  revalidatePath("/scenarios");
  return { ok: true, data: { slug } };
}

export async function deleteScenarioAction(scenarioId: string): Promise<ActionResult> {
  const user = await requireUser();

  // Scoped by author, so another user's id deletes nothing rather than
  // relying on a prior read for safety.
  const [deleted] = await db
    .delete(scenarios)
    .where(and(eq(scenarios.id, scenarioId), eq(scenarios.authorId, user.id)))
    .returning();

  if (!deleted) return { ok: false, error: "Not found." };

  revalidatePath("/scenarios");
  return { ok: true, data: undefined };
}

export async function setScenarioPublishedAction(
  scenarioId: string,
  isPublished: boolean,
): Promise<ActionResult> {
  const user = await requireUser();

  const [updated] = await db
    .update(scenarios)
    .set({ isPublished, updatedAt: new Date() })
    .where(and(eq(scenarios.id, scenarioId), eq(scenarios.authorId, user.id)))
    .returning();

  if (!updated) return { ok: false, error: "Not found." };

  revalidatePath("/scenarios");
  revalidatePath(`/scenarios/${updated.slug}`);
  return { ok: true, data: undefined };
}

/**
 * Deep-copy a scenario to the current user.
 *
 * Copies sections and event tables too — a shallow copy would produce a
 * scenario that looks right in a list and is empty when opened. The copy
 * is always unpublished and owned by the caller, so duplicating someone
 * else's published scenario cannot republish it under their name.
 *
 * Source must be published or owned by the caller; otherwise this would
 * read other users' drafts.
 */
export async function duplicateScenarioAction(
  scenarioId: string,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const user = await requireUser();

  const [source] = await db
    .select()
    .from(scenarios)
    .where(eq(scenarios.id, scenarioId))
    .limit(1);

  if (!source || (!source.isPublished && source.authorId !== user.id)) {
    return { ok: false, error: "Not found." };
  }

  const sections = await db
    .select()
    .from(scenarioSections)
    .where(eq(scenarioSections.scenarioId, scenarioId));
  const tables = await db
    .select()
    .from(eventTables)
    .where(eq(eventTables.scenarioId, scenarioId));

  const slug = await uniqueSlug(user.id, `${source.slug}-copy`);

  const created = await db.transaction(async (tx) => {
    const [copy] = await tx
      .insert(scenarios)
      .values({
        authorId: user.id,
        gameSystemId: source.gameSystemId,
        // Deliberately not copied: the duplicate does not belong to the
        // source's campaign, which the new owner may not have access to.
        campaignId: null,
        slug,
        title: `${source.title} (copy)`.slice(0, 120),
        summary: source.summary,
        playerCount: source.playerCount,
        estimatedMinutes: source.estimatedMinutes,
        tags: source.tags,
        mapData: source.mapData,
        isPublished: false,
      })
      .returning();

    if (sections.length) {
      await tx.insert(scenarioSections).values(
        sections.map(({ id: _id, scenarioId: _s, ...rest }) => ({
          ...rest,
          scenarioId: copy.id,
        })),
      );
    }
    if (tables.length) {
      await tx.insert(eventTables).values(
        tables.map(({ id: _id, scenarioId: _s, ...rest }) => ({
          ...rest,
          scenarioId: copy.id,
        })),
      );
    }
    return copy;
  });

  revalidatePath("/scenarios");
  return { ok: true, data: { id: created.id, slug: created.slug } };
}
