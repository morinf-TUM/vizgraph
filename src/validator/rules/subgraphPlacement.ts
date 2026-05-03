import type { Graph } from "../../document/types";
import { SUBGRAPH_INPUT_NODE_TYPE, SUBGRAPH_OUTPUT_NODE_TYPE } from "../../document/subgraph";
import { CODES } from "../codes";
import { error, type Diagnostic } from "../diagnostics";

export const checkSubgraphPlacement = (graph: Graph, path: number[] = []): Diagnostic[] => {
  if (path.length > 0) return [];
  const out: Diagnostic[] = [];
  for (const node of graph.nodes) {
    if (node.type === SUBGRAPH_INPUT_NODE_TYPE || node.type === SUBGRAPH_OUTPUT_NODE_TYPE) {
      out.push(
        error({
          code: CODES.PSEUDO_NODE_AT_ROOT,
          message: `${node.type} node ${String(node.id)} cannot live at the root level; place it inside a Subgraph.`,
          node_id: node.id,
        }),
      );
    }
  }
  return out;
};
