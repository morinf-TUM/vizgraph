import type { GraphDocument } from "../../document/types";
import { CODES } from "../codes";
import { error, type Diagnostic } from "../diagnostics";

// Defensive layer: NodeSchema already enforces frequency_hz > 0 at parse time,
// so this rule is only reachable on documents constructed by direct mutation
// (e.g. reactive editor stores) that bypass Zod.
//
// CODES.FREQUENCY_FOR_MISSING_NODE is reserved but not implemented here: the
// current GraphDocument keeps frequency_hz as a property of an existing
// GraphNode, leaving no way for it to point at a missing node id. Revisit
// if/when a graph-level frequency map is added.

export const checkInvalidFrequency = (doc: GraphDocument): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];
  for (const node of doc.graph.nodes) {
    const f = node.frequency_hz;
    if (f === undefined || f === null) continue;
    if (!Number.isFinite(f) || f <= 0) {
      diagnostics.push(
        error({
          code: CODES.INVALID_FREQUENCY,
          message: `Node ${String(node.id)} has invalid frequency_hz: ${String(f)}.`,
          node_id: node.id,
          field: "frequency_hz",
        }),
      );
    }
  }
  return diagnostics;
};
