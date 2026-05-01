import type { GraphDocument } from "../../document/types";
import { CODES } from "../codes";
import { error, type Diagnostic } from "../diagnostics";

// Emit one diagnostic per duplicated id value (not per occurrence): the
// ValidationPanel jumps to a single node per diagnostic (spec §148), so N-1
// redundant entries pointing at the same id would clutter the panel without
// adding navigation value. Order follows first occurrence in the nodes array
// for deterministic output.
export const checkDuplicateNodeIds = (doc: GraphDocument): Diagnostic[] => {
  const seen = new Set<number>();
  const reported = new Set<number>();
  const diagnostics: Diagnostic[] = [];

  for (const node of doc.graph.nodes) {
    if (seen.has(node.id) && !reported.has(node.id)) {
      diagnostics.push(
        error({
          code: CODES.DUPLICATE_NODE_ID,
          message: `Duplicate node ID: ${String(node.id)}.`,
          node_id: node.id,
        }),
      );
      reported.add(node.id);
    }
    seen.add(node.id);
  }

  return diagnostics;
};
