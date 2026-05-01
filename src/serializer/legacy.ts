import * as z from "zod";
import { edgeIdFor } from "../document/ids";
import type { GraphNode, GraphEdge, GraphDocument } from "../document/types";
import { GraphDocumentSchema } from "../document/types";
import type { LoadResult } from "./versioned";

const LegacyNodeSchema = z.object({
  uid: z.number().int(),
  name: z.string().optional(),
  type: z.string(),
  value: z.number().int().optional(),
});

const LegacyEdgeSchema = z.object({
  src: z.number().int(),
  dst: z.number().int(),
  port_out: z.string(),
  port_in: z.string(),
});

const LegacyShapeSchema = z.object({
  nodes: z.array(LegacyNodeSchema),
  edges: z.array(LegacyEdgeSchema),
});

const DEFAULT_X_STRIDE = 200;

export const safeLoadLegacy = (input: unknown): LoadResult => {
  const r = LegacyShapeSchema.safeParse(input);
  if (!r.success) return { success: false, error: r.error.message };

  const nodes: GraphNode[] = [];
  for (const [idx, n] of r.data.nodes.entries()) {
    const parameters: Record<string, unknown> = {};
    if (n.type === "Constant") {
      if (n.value === undefined) {
        return {
          success: false,
          error: `Constant node ${n.uid} missing required value`,
        };
      }
      parameters.value = n.value;
    }
    nodes.push({
      id: n.uid,
      ...(n.name !== undefined ? { name: n.name } : {}),
      type: n.type,
      position: { x: idx * DEFAULT_X_STRIDE, y: 0 },
      parameters,
    });
  }

  const edges: GraphEdge[] = r.data.edges.map(
    (e): GraphEdge => ({
      id: edgeIdFor(e.src, e.port_out, e.dst, e.port_in),
      source: { node: e.src, port: e.port_out },
      target: { node: e.dst, port: e.port_in },
    }),
  );

  const doc: GraphDocument = { version: 1, graph: { nodes, edges, comments: [] } };
  const final = GraphDocumentSchema.safeParse(doc);
  if (!final.success) return { success: false, error: final.error.message };
  return { success: true, data: final.data };
};

// Public alias kept so future Task 10 dispatch can import either name.
export const loadLegacy = safeLoadLegacy;
