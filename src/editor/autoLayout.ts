import dagre from "@dagrejs/dagre";
import type { GraphDocument, Position } from "../document/types";

const DEFAULT_NODE_W = 160;
const DEFAULT_NODE_H = 70;

interface LaidOutNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Pure layout: produces a fresh Position map keyed by node id without
// touching the input. Caller writes the positions back through the
// documentStore as a single transaction so undo/redo work.
export const layoutGraph = (doc: GraphDocument): Map<number, Position> => {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of doc.graph.nodes) {
    g.setNode(String(node.id), { width: DEFAULT_NODE_W, height: DEFAULT_NODE_H });
  }
  for (const edge of doc.graph.edges) {
    g.setEdge(String(edge.source.node), String(edge.target.node));
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- dagre's layout() expects a fully-parameterised graph type that is awkward to construct for our minimal label needs; the call is type-safe in practice.
  dagre.layout(g);

  const positions = new Map<number, Position>();
  for (const node of doc.graph.nodes) {
    const laid = g.node(String(node.id)) as LaidOutNode | undefined;
    if (!laid) continue;
    // Dagre returns the centre of the node; convert to top-left (VueFlow
    // expects top-left positions).
    positions.set(node.id, {
      x: laid.x - DEFAULT_NODE_W / 2,
      y: laid.y - DEFAULT_NODE_H / 2,
    });
  }
  return positions;
};
