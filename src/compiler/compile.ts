import type { Graph, GraphDocument, GraphNode } from "../document/types";
import {
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
} from "../document/subgraph";
import { resolveTarget, pathKey } from "../document/subgraphChase";

// Output shape: legacy JSON (the format the C++ runtime already reads) plus an
// optional `frequency_hz` field per node when one is set on the document. The
// runtime ingests legacy unchanged; consumers that read `frequency_hz` can
// route it through GraphMT::set_node_frequency. This intentionally drops
// editor-only state (positions, viewport, edge.id).
//
// compile() throws on invariants that should have been caught by validate().
// The editor pipeline is expected to call validate() first and refuse export
// on errors (spec section 8). The throws here are belt-and-suspenders for
// callers that bypass validation.

export interface CompiledNode {
  uid: number;
  name?: string;
  type: string;
  value?: number;
  frequency_hz?: number;
}

export interface CompiledEdge {
  src: number;
  dst: number;
  port_out: string;
  port_in: string;
}

export interface CompiledGraph {
  nodes: CompiledNode[];
  edges: CompiledEdge[];
}

export interface CompiledOutput {
  graph: CompiledGraph;
  // Editor-only — path key (slash-joined integer ids) → uid. Used by the
  // executionStore's run-result overlay to project per-uid runtime values
  // back to (path, local-id) display positions.
  idMap: Map<string, number>;
}

const isPseudoOrContainer = (t: string): boolean =>
  t === SUBGRAPH_NODE_TYPE || t === SUBGRAPH_INPUT_NODE_TYPE || t === SUBGRAPH_OUTPUT_NODE_TYPE;

const compileNode = (node: GraphNode, uid: number): CompiledNode => {
  const out: CompiledNode = { uid, type: node.type };
  if (node.name !== undefined) out.name = node.name;
  if (node.type === "Constant") {
    const v = node.parameters.value;
    if (v === undefined) {
      throw new Error(
        `Cannot compile node ${String(node.id)}: Constant requires parameters.value.`,
      );
    }
    if (typeof v !== "number") {
      throw new Error(
        `Cannot compile node ${String(node.id)}: Constant value must be an integer, got ${typeof v}.`,
      );
    }
    if (!Number.isInteger(v)) {
      throw new Error(
        `Cannot compile node ${String(node.id)}: Constant value must be an integer, got ${String(v)}.`,
      );
    }
    out.value = v;
  }
  if (node.frequency_hz !== undefined && node.frequency_hz !== null) {
    out.frequency_hz = node.frequency_hz;
  }
  return out;
};

export const compile = (doc: GraphDocument): CompiledOutput => {
  const idMap = new Map<string, number>();
  const nodes: CompiledNode[] = [];
  let nextUid = 1;

  // Pass 1: emit real nodes in DFS order, populating idMap.
  const collect = (graph: Graph, path: number[]): void => {
    for (const node of graph.nodes) {
      if (node.type === SUBGRAPH_NODE_TYPE) {
        const params = node.parameters as { children?: GraphDocument };
        if (params.children) collect(params.children.graph, [...path, node.id]);
        continue;
      }
      if (node.type === SUBGRAPH_INPUT_NODE_TYPE || node.type === SUBGRAPH_OUTPUT_NODE_TYPE) {
        continue;
      }
      const uid = nextUid++;
      idMap.set(pathKey(path, node.id), uid);
      nodes.push(compileNode(node, uid));
    }
  };
  collect(doc.graph, []);

  // Pass 2: emit edges. Canonical rule: emit only at edges whose source is a
  // regular node. Use multi-valued resolveTarget for fan-out across boundaries.
  const edges: CompiledEdge[] = [];
  const emitFromLevel = (graph: Graph, path: number[]): void => {
    for (const edge of graph.edges) {
      const srcNode = graph.nodes.find((n) => n.id === edge.source.node);
      if (!srcNode) continue;
      if (isPseudoOrContainer(srcNode.type)) continue;
      const srcUid = idMap.get(pathKey(path, srcNode.id));
      if (srcUid === undefined) continue;
      const targets = resolveTarget(doc, path, edge.target);
      for (const t of targets) {
        const tUid = idMap.get(pathKey(t.path, t.node));
        if (tUid === undefined) {
          throw new Error(
            `Cannot resolve target uid for path ${pathKey(t.path, t.node)} (edge ${edge.id}).`,
          );
        }
        edges.push({ src: srcUid, dst: tUid, port_out: edge.source.port, port_in: t.port });
      }
    }
    for (const node of graph.nodes) {
      if (node.type === SUBGRAPH_NODE_TYPE) {
        const params = node.parameters as { children?: GraphDocument };
        if (params.children) emitFromLevel(params.children.graph, [...path, node.id]);
      }
    }
  };
  emitFromLevel(doc.graph, []);

  return { graph: { nodes, edges }, idMap };
};
