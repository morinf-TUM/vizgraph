import type { Graph } from "../../document/types";
import { CODES } from "../codes";
import { error, type Diagnostic } from "../diagnostics";

// Both rules emit one diagnostic per duplicated id value (not per occurrence):
// the ValidationPanel jumps to a single node/edge per diagnostic (spec §148),
// so N-1 redundant entries pointing at the same id would clutter the panel
// without adding navigation value. Order follows first occurrence for
// deterministic output.
export const checkDuplicateNodeIds = (graph: Graph, path: number[] = []): Diagnostic[] => {
  const seen = new Set<number>();
  const reported = new Set<number>();
  const diagnostics: Diagnostic[] = [];

  for (const node of graph.nodes) {
    if (seen.has(node.id) && !reported.has(node.id)) {
      diagnostics.push(
        error({
          code: CODES.DUPLICATE_NODE_ID,
          message: `Duplicate node ID: ${String(node.id)}.`,
          node_id: node.id,
          ...(path.length > 0 ? { path } : {}),
        }),
      );
      reported.add(node.id);
    }
    seen.add(node.id);
  }

  return diagnostics;
};

export const checkDuplicateEdgeIds = (graph: Graph, path: number[] = []): Diagnostic[] => {
  const seen = new Set<string>();
  const reported = new Set<string>();
  const diagnostics: Diagnostic[] = [];

  for (const edge of graph.edges) {
    if (seen.has(edge.id) && !reported.has(edge.id)) {
      diagnostics.push(
        error({
          code: CODES.DUPLICATE_EDGE_ID,
          message: `Duplicate edge ID: ${edge.id}.`,
          edge_id: edge.id,
          ...(path.length > 0 ? { path } : {}),
        }),
      );
      reported.add(edge.id);
    }
    seen.add(edge.id);
  }

  return diagnostics;
};
