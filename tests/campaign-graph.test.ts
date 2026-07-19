/**
 * Campaign graph validation.
 *
 * The graph is JSONB, so the database enforces nothing about it. These
 * rules are the only thing preventing a saved graph that renders as a
 * broken editor with no visible cause.
 */
import { describe, expect, it } from "vitest";

import { campaignGraphSchema, EMPTY_GRAPH } from "@/lib/validations/campaign";

/**
 * Deliberately untyped: several cases feed intentionally invalid shapes
 * (unknown node types, dangling edges) that the schema must reject, and
 * typing the helper to CampaignGraph would make those uncompilable.
 */
function graph(partial: { nodes?: unknown[]; edges?: unknown[] }): unknown {
  return { nodes: [], edges: [], ...partial };
}

const startNode = { id: "n1", type: "start", label: "Begin", x: 0, y: 0 };
const scenarioNode = { id: "n2", type: "scenario", label: "The Ford", x: 100, y: 0 };

describe("campaignGraphSchema", () => {
  it("accepts an empty graph", () => {
    expect(campaignGraphSchema.safeParse(EMPTY_GRAPH).success).toBe(true);
  });

  it("accepts a valid two-node graph", () => {
    const result = campaignGraphSchema.safeParse(
      graph({
        nodes: [startNode, scenarioNode],
        edges: [{ id: "e1", from: "n1", to: "n2", label: "always" }],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects an edge starting at a missing node", () => {
    // Would render as an edge from nowhere.
    const result = campaignGraphSchema.safeParse(
      graph({
        nodes: [scenarioNode],
        edges: [{ id: "e1", from: "ghost", to: "n2", label: "always" }],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/does not exist/);
    }
  });

  it("rejects an edge ending at a missing node", () => {
    const result = campaignGraphSchema.safeParse(
      graph({
        nodes: [startNode],
        edges: [{ id: "e1", from: "n1", to: "ghost", label: "always" }],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a self-looping edge", () => {
    const result = campaignGraphSchema.safeParse(
      graph({
        nodes: [startNode],
        edges: [{ id: "e1", from: "n1", to: "n1", label: "always" }],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/itself/);
    }
  });

  it("rejects duplicate node ids", () => {
    // Two nodes with one id makes edge resolution ambiguous.
    const result = campaignGraphSchema.safeParse(
      graph({ nodes: [startNode, { ...scenarioNode, id: "n1" }] }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/duplicate/i);
    }
  });

  it("rejects more than one start node", () => {
    // "Where does this campaign begin?" must have one answer.
    const result = campaignGraphSchema.safeParse(
      graph({ nodes: [startNode, { ...startNode, id: "n9" }] }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /one start node/.test(i.message))).toBe(
        true,
      );
    }
  });

  it("allows several scenario and reward nodes", () => {
    const result = campaignGraphSchema.safeParse(
      graph({
        nodes: [
          startNode,
          scenarioNode,
          { id: "n3", type: "scenario", label: "The Chapel", x: 200, y: 0 },
          { id: "n4", type: "reward", label: "Salvage", x: 300, y: 0 },
          { id: "n5", type: "finale", label: "The Last Bell", x: 400, y: 0 },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects an unknown node type", () => {
    const result = campaignGraphSchema.safeParse(
      graph({ nodes: [{ ...startNode, type: "boss-fight" }] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an unknown edge label", () => {
    const result = campaignGraphSchema.safeParse(
      graph({
        nodes: [startNode, scenarioNode],
        edges: [{ id: "e1", from: "n1", to: "n2", label: "maybe" }],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("supports branching outcomes from one node", () => {
    // Victory and defeat leading to different scenarios is the whole
    // point of the graph.
    const result = campaignGraphSchema.safeParse(
      graph({
        nodes: [
          startNode,
          scenarioNode,
          { id: "n3", type: "scenario", label: "Retreat", x: 200, y: 100 },
        ],
        edges: [
          { id: "e1", from: "n1", to: "n2", label: "victory" },
          { id: "e2", from: "n1", to: "n3", label: "defeat" },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects positions far outside the canvas", () => {
    const result = campaignGraphSchema.safeParse(
      graph({ nodes: [{ ...startNode, x: 999_999 }] }),
    );
    expect(result.success).toBe(false);
  });

  it("caps graph size", () => {
    // An unbounded graph is a denial-of-service payload.
    const nodes = Array.from({ length: 201 }, (_, i) => ({
      id: `n${i}`,
      type: "scenario",
      label: `Node ${i}`,
      x: 0,
      y: 0,
    }));
    expect(campaignGraphSchema.safeParse(graph({ nodes })).success).toBe(false);
  });
});
