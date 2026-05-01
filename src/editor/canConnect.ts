import type { EdgeEndpoint, GraphDocument } from "../document/types";
import type { NodeTypeRegistry } from "../registry/registry";

export type ConnectCheck = { ok: true } | { ok: false; reason: string };

// Pre-add gate for the canvas. Mirrors the post-add diagnostics emitted by
// src/validator/rules/ports.ts but answers a single yes/no for the UI's
// connection event. Sharing the logic with ports.ts would entangle two
// different return shapes; the duplication is contained and small.
export const canConnect = (
  doc: GraphDocument,
  registry: NodeTypeRegistry,
  source: EdgeEndpoint,
  target: EdgeEndpoint,
): ConnectCheck => {
  if (source.node === target.node) {
    return { ok: false, reason: "self-loop" };
  }
  const sourceNode = doc.graph.nodes.find((n) => n.id === source.node);
  const targetNode = doc.graph.nodes.find((n) => n.id === target.node);
  if (!sourceNode) return { ok: false, reason: "missing source node" };
  if (!targetNode) return { ok: false, reason: "missing target node" };

  const sourceType = registry.get(sourceNode.type);
  const targetType = registry.get(targetNode.type);
  if (!sourceType) return { ok: false, reason: "unknown source node type" };
  if (!targetType) return { ok: false, reason: "unknown target node type" };

  const sourcePort = sourceType.outputs.find((p) => p.name === source.port);
  const targetPort = targetType.inputs.find((p) => p.name === target.port);
  if (!sourcePort) {
    return { ok: false, reason: `unknown output port ${source.port} on ${sourceType.type}` };
  }
  if (!targetPort) {
    return { ok: false, reason: `unknown input port ${target.port} on ${targetType.type}` };
  }
  if (
    sourcePort.type !== undefined &&
    targetPort.type !== undefined &&
    sourcePort.type !== targetPort.type
  ) {
    return {
      ok: false,
      reason: `port type mismatch: ${sourcePort.type} -> ${targetPort.type}`,
    };
  }
  return { ok: true };
};
