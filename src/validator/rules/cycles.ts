import type { Graph, GraphEdge } from "../../document/types";
import { CODES } from "../codes";
import { error, type Diagnostic } from "../diagnostics";

// DFS coloring with the active path tracked as a stack: when an outgoing edge
// hits a node already in the path (gray), the edge is a back-edge and the
// stack slice from that node forms a cycle. One diagnostic per back-edge
// (edge_id pinpoints the closing edge).
//
// Self-loops and edges with missing endpoints are skipped: SELF_LOOP and
// MISSING_*_NODE rules already report those, and re-emitting here would
// double-count.

type Color = "white" | "gray" | "black";

export const checkCycles = (graph: Graph, path: number[] = []): Diagnostic[] => {
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const adjacency = new Map<number, GraphEdge[]>();
  for (const id of nodeIds) adjacency.set(id, []);
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source.node) || !nodeIds.has(edge.target.node)) continue;
    if (edge.source.node === edge.target.node) continue;
    adjacency.get(edge.source.node)?.push(edge);
  }

  const color = new Map<number, Color>();
  for (const id of nodeIds) color.set(id, "white");

  const dfsPath: number[] = [];
  const diagnostics: Diagnostic[] = [];

  const dfs = (u: number): void => {
    color.set(u, "gray");
    dfsPath.push(u);
    for (const edge of adjacency.get(u) ?? []) {
      const v = edge.target.node;
      const c = color.get(v);
      if (c === "white") {
        dfs(v);
      } else if (c === "gray") {
        const startIdx = dfsPath.indexOf(v);
        const cycle = [...dfsPath.slice(startIdx), v];
        diagnostics.push(
          error({
            code: CODES.CYCLE,
            message: `Cycle detected: ${cycle.map(String).join(" -> ")}.`,
            edge_id: edge.id,
            ...(path.length > 0 ? { path } : {}),
          }),
        );
      }
    }
    dfsPath.pop();
    color.set(u, "black");
  };

  for (const node of graph.nodes) {
    if (color.get(node.id) === "white") dfs(node.id);
  }

  return diagnostics;
};
