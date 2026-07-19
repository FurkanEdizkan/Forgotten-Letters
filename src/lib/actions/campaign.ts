"use server";

/**
 * Campaign CRUD.
 *
 * Mirrors the scenario actions: ownership is re-read from the database
 * on every mutation, deletes are scoped by authorId in the WHERE clause,
 * and "Not found" covers both missing and forbidden so the response does
 * not confirm which ids exist.
 *
 * Campaigns own a node graph (campaigns.graph, JSONB). The graph is
 * validated for shape and internal consistency here — a graph with an
 * edge pointing at a missing node would render as a broken editor with
 * no obvious cause.
 */
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { campaigns, scenarios } from "@/lib/db/schema";
import { stripHtml } from "@/lib/sanitize";
import {
  campaignSchema,
  campaignGraphSchema,
  slugify,
} from "@/lib/validations/campaign";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

async function uniqueSlug(
  authorId: string,
  desired: string,
  excludeId?: string,
): Promise<string> {
  let candidate = desired;
  for (let n = 2; n < 100; n++) {
    const [clash] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(and(eq(campaigns.authorId, authorId), eq(campaigns.slug, candidate)))
      .limit(1);
    if (!clash || clash.id === excludeId) return candidate;
    candidate = `${desired}-${n}`.slice(0, 80).replace(/-+$/g, "");
  }
  return `${desired}-${Date.now()}`.slice(0, 80);
}

export async function createCampaignAction(
  raw: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const user = await requireUser();

  const parsed = campaignSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const input = parsed.data;
  const slug = await uniqueSlug(user.id, input.slug || slugify(input.title));

  const [created] = await db
    .insert(campaigns)
    .values({
      authorId: user.id,
      gameSystemId: input.gameSystemId,
      slug,
      title: input.title,
      summary: input.summary ? stripHtml(input.summary) : undefined,
      isPublished: false,
    })
    .returning();

  revalidatePath("/campaigns");
  return { ok: true, data: { id: created.id, slug: created.slug } };
}

export async function updateCampaignAction(
  campaignId: string,
  raw: unknown,
): Promise<ActionResult<{ slug: string }>> {
  const user = await requireUser();

  const parsed = campaignSchema.safeParse(raw);
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
    campaignId,
  );

  const [updated] = await db
    .update(campaigns)
    .set({
      gameSystemId: input.gameSystemId,
      slug,
      title: input.title,
      summary: input.summary ? stripHtml(input.summary) : null,
      updatedAt: new Date(),
    })
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.authorId, user.id)))
    .returning();

  if (!updated) return { ok: false, error: "Not found." };

  revalidatePath("/campaigns");
  return { ok: true, data: { slug } };
}

/**
 * Save the campaign graph.
 *
 * Separate from the metadata update because the graph editor saves far
 * more often than the title changes, and sending the whole record on
 * every node drag would be wasteful.
 */
export async function saveCampaignGraphAction(
  campaignId: string,
  raw: unknown,
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = campaignGraphSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That graph is not valid.",
    };
  }

  const [updated] = await db
    .update(campaigns)
    .set({ graph: parsed.data, updatedAt: new Date() })
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.authorId, user.id)))
    .returning();

  if (!updated) return { ok: false, error: "Not found." };

  revalidatePath("/campaigns");
  return { ok: true, data: undefined };
}

export async function setCampaignPublishedAction(
  campaignId: string,
  isPublished: boolean,
): Promise<ActionResult> {
  const user = await requireUser();

  const [updated] = await db
    .update(campaigns)
    .set({ isPublished, updatedAt: new Date() })
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.authorId, user.id)))
    .returning();

  if (!updated) return { ok: false, error: "Not found." };

  revalidatePath("/campaigns");
  return { ok: true, data: undefined };
}

export async function deleteCampaignAction(campaignId: string): Promise<ActionResult> {
  const user = await requireUser();

  const [deleted] = await db
    .delete(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.authorId, user.id)))
    .returning();

  if (!deleted) return { ok: false, error: "Not found." };

  // Scenarios survive: the FK is ON DELETE SET NULL, so they become
  // standalone rather than being destroyed with the campaign.
  revalidatePath("/campaigns");
  revalidatePath("/scenarios");
  return { ok: true, data: undefined };
}

/**
 * Attach or detach a scenario from a campaign.
 *
 * Both the scenario and the campaign must belong to the caller — without
 * the second check a user could file someone else's scenario into their
 * own campaign, or their own scenario into someone else's.
 */
export async function setScenarioCampaignAction(
  scenarioId: string,
  campaignId: string | null,
): Promise<ActionResult> {
  const user = await requireUser();

  if (campaignId) {
    const [campaign] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.authorId, user.id)))
      .limit(1);
    if (!campaign) return { ok: false, error: "Not found." };
  }

  const [updated] = await db
    .update(scenarios)
    .set({ campaignId, updatedAt: new Date() })
    .where(and(eq(scenarios.id, scenarioId), eq(scenarios.authorId, user.id)))
    .returning();

  if (!updated) return { ok: false, error: "Not found." };

  revalidatePath("/campaigns");
  return { ok: true, data: undefined };
}
