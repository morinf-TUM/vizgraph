import type { GraphDocument } from "../document/types";

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

export const compile = (doc: GraphDocument): CompiledOutput => {
  const idMap = new Map<string, number>();
  const nodes: CompiledNode[] = doc.graph.nodes.map((node): CompiledNode => {
    idMap.set(String(node.id), node.id);
    const out: CompiledNode = { uid: node.id, type: node.type };
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
  });

  const edges: CompiledEdge[] = doc.graph.edges.map(
    (edge): CompiledEdge => ({
      src: edge.source.node,
      dst: edge.target.node,
      port_out: edge.source.port,
      port_in: edge.target.port,
    }),
  );

  return { graph: { nodes, edges }, idMap };
};
