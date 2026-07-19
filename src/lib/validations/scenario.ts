/**
 * Scenario input schemas.
 *
 * Every scenario server action validates through these. Limits here are
 * deliberate: unbounded text fields are a denial-of-service vector when
 * anyone can publish.
 */
import { z } from "zod";

/** Section types, mirroring the section_type enum in the schema. */
export const SECTION_TYPES = [
  "narrative",
  "objectives",
  "deployment",
  "special_rules",
  "victory_conditions",
  "event_table",
  "aftermath",
] as const;

/**
 * URL-safe slug. Generated from the title but user-editable, so it is
 * validated rather than trusted — it ends up in a route path.
 */
export const slugSchema = z
  .string()
  .min(3, "Slug must be at least 3 characters")
  .max(80, "Slug must be at most 80 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug may contain only lowercase letters, numbers, and single hyphens",
  );

export const titleSchema = z
  .string()
  .trim()
  .min(3, "Title must be at least 3 characters")
  .max(120, "Title must be at most 120 characters");

export const summarySchema = z
  .string()
  .trim()
  .max(500, "Summary must be at most 500 characters")
  .optional()
  .or(z.literal("").transform(() => undefined));

/** Rich-text body. Sanitized separately on write; this only bounds size. */
const bodySchema = z
  .string()
  .max(20_000, "Section body must be at most 20,000 characters");

export const scenarioSectionSchema = z.object({
  type: z.enum(SECTION_TYPES),
  heading: z.string().trim().max(120).optional(),
  body: bodySchema.optional(),
  position: z.number().int().min(0).max(100),
});

export const eventTableEntrySchema = z
  .object({
    min: z.number().int().min(1).max(1000),
    max: z.number().int().min(1).max(1000),
    result: z.string().trim().min(1).max(500),
  })
  .refine((e) => e.min <= e.max, {
    message: "Range start must not exceed range end",
    path: ["min"],
  });

export const eventTableSchema = z.object({
  title: z.string().trim().min(1).max(120),
  diceNotation: z
    .string()
    .trim()
    .regex(/^\d*d\d+([+-]\d+)?$/i, "Use dice notation such as d6, 2d6, or d6+1")
    .max(20),
  entries: z.array(eventTableEntrySchema).max(100),
  position: z.number().int().min(0).max(100),
});

export const scenarioSchema = z.object({
  title: titleSchema,
  slug: slugSchema,
  summary: summarySchema,
  gameSystemId: z.string().min(1, "Pick a game system"),
  campaignId: z.string().min(1).optional().nullable(),
  // A scenario for 0 players is meaningless; 12 is a generous ceiling.
  playerCount: z.number().int().min(1).max(12).optional().nullable(),
  estimatedMinutes: z.number().int().min(5).max(1440).optional().nullable(),
  tags: z
    .array(z.string().trim().toLowerCase().min(1).max(30))
    .max(10, "At most 10 tags")
    .default([]),
  sections: z.array(scenarioSectionSchema).max(20).default([]),
  eventTables: z.array(eventTableSchema).max(10).default([]),
});

export const campaignSchema = z.object({
  title: titleSchema,
  slug: slugSchema,
  summary: summarySchema,
  gameSystemId: z.string().min(1, "Pick a game system"),
});

export type ScenarioInput = z.infer<typeof scenarioSchema>;
export type CampaignInput = z.infer<typeof campaignSchema>;
export type ScenarioSectionInput = z.infer<typeof scenarioSectionSchema>;
export type EventTableInput = z.infer<typeof eventTableSchema>;

/**
 * Derive a slug from a title.
 *
 * Best-effort only — the result is still validated by slugSchema, since
 * a title of "!!!" would otherwise produce an empty slug.
 */
export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-")
      .slice(0, 80)
      // A trailing hyphen after truncation would fail slugSchema.
      .replace(/-+$/g, "")
  );
}
