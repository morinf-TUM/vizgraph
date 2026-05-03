import type { Graph, GraphDocument, GraphNode } from "../../document/types";
import {
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
} from "../../document/subgraph";
import { CODES } from "../codes";
import { warning, type Diagnostic } from "../diagnostics";

const childGraph = (subgraphNode: GraphNode): Graph | null => {
  const p = subgraphNode.parameters as { children?: GraphDocument };
  return p.children?.graph ?? null;
};

export const checkSubgraphConnectivity = (graph: Graph, path: number[] = []): Diagnostic[] => {
  const out: Diagnostic[] = [];
  for (const node of graph.nodes) {
    if (node.type === SUBGRAPH_INPUT_NODE_TYPE) {
      const consumed = graph.edges.some((e) => e.source.node === node.id);
      if (!consumed) {
        out.push(
          warning({
            code: CODES.SUBGRAPH_INPUT_UNCONNECTED,
            message: `SubgraphInput ${String(node.id)} has no internal consumer.`,
            node_id: node.id,
            ...(path.length > 0 ? { path } : {}),
          }),
        );
      }
    } else if (node.type === SUBGRAPH_OUTPUT_NODE_TYPE) {
      const sourced = graph.edges.some((e) => e.target.node === node.id);
      if (!sourced) {
        out.push(
          warning({
            code: CODES.SUBGRAPH_OUTPUT_UNCONNECTED,
            message: `SubgraphOutput ${String(node.id)} has no internal source.`,
            node_id: node.id,
            ...(path.length > 0 ? { path } : {}),
          }),
        );
      }
    } else if (node.type === SUBGRAPH_NODE_TYPE) {
      const cg = childGraph(node);
      if (cg && cg.nodes.length === 0) {
        out.push(
          warning({
            code: CODES.EMPTY_SUBGRAPH,
            message: `Subgraph ${String(node.id)} contains no nodes.`,
            node_id: node.id,
            ...(path.length > 0 ? { path } : {}),
          }),
        );
      }
    }
  }
  return out;
};
