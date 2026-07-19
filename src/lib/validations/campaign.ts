/**
 * Campaign input schemas, including the node graph.
 *
 * The graph is stored as JSONB, so the database enforces nothing about
 * its shape. Everything that keeps it coherent lives here.
 */
import { z } from "zod";

import { slugSchema, summarySchema, titleSchema } from "./scenario";

export { slugify } from "./scenario";

export const campaignSchema = z.object({
  title: titleSchema,
  slug: slugSchema,
  summary: summarySchema,
  gameSystemId: z.string().min(1, "Pick a game system"),
});

/**
 * Node kinds, from the TODO's graph editor description:
 * Start / Scenario / Finale, plus reward nodes.
 */
export const NODE_TYPES = ["start", "scenario", "reward", "finale"] as const;

/** Edge labels for branching outcomes. */
export const EDGE_LABELS = ["victory", "defeat", "draw", "always"] as const;

export const graphNodeSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(NODE_TYPES),
  label: z.string().trim().min(1).max(120),
  // Optional link to a real scenario row; a node can be a placeholder
  // while the campaign is being sketched out.
  scenarioId: z.string().min(1).max(64).optional().nullable(),
  notes: z.string().trim().max(2_000).optional(),
  // Canvas position. Bounded so a corrupt value cannot push a node
  // somewhere unreachable in the editor viewport.
  x: z.number().min(-10_000).max(10_000),
  y: z.number().min(-10_000).max(10_000),
});

export const graphEdgeSchema = z.object({
  id: z.string().min(1).max(64),
  from: z.string().min(1).max(64),
  to: z.string().min(1).max(64),
  label: z.enum(EDGE_LABELS).default("always"),
});

export const campaignGraphSchema = z
  .object({
    nodes: z.array(graphNodeSchema).max(200),
    edges: z.array(graphEdgeSchema).max(400),
  })
  .superRefine((graph, ctx) => {
    const ids = new Set<string>();
    for (const node of graph.nodes) {
      if (ids.has(node.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate node id: ${node.id}`,
          path: ["nodes"],
        });
      }
      ids.add(node.id);
    }

    // An edge pointing at a missing node renders as a broken editor with
    // no visible cause, so reject it at the boundary instead.
    for (const edge of graph.edges) {
      if (!ids.has(edge.from)) {
        ctx.addIssue({
          code: "custom",
          message: `Edge ${edge.id} starts at a node that does not exist`,
          path: ["edges"],
        });
      }
      if (!ids.has(edge.to)) {
        ctx.addIssue({
          code: "custom",
          message: `Edge ${edge.id} ends at a node that does not exist`,
          path: ["edges"],
        });
      }
      if (edge.from === edge.to) {
        ctx.addIssue({
          code: "custom",
          message: `Edge ${edge.id} loops a node to itself`,
          path: ["edges"],
        });
      }
    }

    // More than one start makes "where does this campaign begin?"
    // ambiguous for anyone reading it.
    const starts = graph.nodes.filter((n) => n.type === "start");
    if (starts.length > 1) {
      ctx.addIssue({
        code: "custom",
        message: "A campaign can only have one start node",
        path: ["nodes"],
      });
    }
  });

export type CampaignInput = z.infer<typeof campaignSchema>;
export type CampaignGraph = z.infer<typeof campaignGraphSchema>;
export type GraphNode = z.infer<typeof graphNodeSchema>;
export type GraphEdge = z.infer<typeof graphEdgeSchema>;

/** An empty graph, used when a campaign has none yet. */
export const EMPTY_GRAPH: CampaignGraph = { nodes: [], edges: [] };
