import type { GraphDocument } from "../../document/types";
import { CODES } from "../codes";
import { error, type Diagnostic } from "../diagnostics";

// Edge-structural rules: each offending edge produces its own diagnostic
// (granularity per-edge, not per-distinct-missing-id). Each edge is a
// genuinely distinct violator with its own edge_id, so the dedup convention
// used for duplicate-id rules does not apply here.

export const checkMissingEdgeEndpoints = (doc: GraphDocument): Diagnostic[] => {
  const nodeIds = new Set(doc.graph.nodes.map((n) => n.id));
  const diagnostics: Diagnostic[] = [];

  for (const edge of doc.graph.edges) {
    if (!nodeIds.has(edge.source.node)) {
      diagnostics.push(
        error({
          code: CODES.MISSING_SOURCE_NODE,
          message: `Edge ${edge.id} references missing source node ${String(edge.source.node)}.`,
          edge_id: edge.id,
          node_id: edge.source.node,
          field: "source.node",
        }),
      );
    }
    if (!nodeIds.has(edge.target.node)) {
      diagnostics.push(
        error({
          code: CODES.MISSING_TARGET_NODE,
          message: `Edge ${edge.id} references missing target node ${String(edge.target.node)}.`,
          edge_id: edge.id,
          node_id: edge.target.node,
          field: "target.node",
        }),
      );
    }
  }

  return diagnostics;
};

export const checkSelfLoops = (doc: GraphDocument): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];

  for (const edge of doc.graph.edges) {
    if (edge.source.node === edge.target.node) {
      diagnostics.push(
        error({
          code: CODES.SELF_LOOP,
          message: `Edge ${edge.id} is a self-loop on node ${String(edge.source.node)}.`,
          edge_id: edge.id,
          node_id: edge.source.node,
        }),
      );
    }
  }

  return diagnostics;
};
