import type { EdgeEndpoint, GraphDocument } from "../document/types";
import {
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
} from "../document/subgraph";
import type { NodeTypeRegistry } from "../registry/registry";

export type ConnectCheck = { ok: true } | { ok: false; reason: string };

const subgraphPortType = (
  doc: GraphDocument,
  subgraphNodeId: number,
  port: string,
  side: "input" | "output",
): string | undefined => {
  const node = doc.graph.nodes.find((n) => n.id === subgraphNodeId);
  if (!node || node.type !== SUBGRAPH_NODE_TYPE) return undefined;
  const params = node.parameters as { children?: GraphDocument };
  const child = params.children?.graph;
  if (!child) return undefined;
  const wantedType = side === "input" ? SUBGRAPH_INPUT_NODE_TYPE : SUBGRAPH_OUTPUT_NODE_TYPE;
  const pseudo = child.nodes.find(
    (n) => n.type === wantedType && (n.parameters as { name?: string }).name === port,
  );
  return (pseudo?.parameters as { portType?: string } | undefined)?.portType;
};

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
  if (source.node === target.node) return { ok: false, reason: "self-loop" };
  const sourceNode = doc.graph.nodes.find((n) => n.id === source.node);
  const targetNode = doc.graph.nodes.find((n) => n.id === target.node);
  if (!sourceNode) return { ok: false, reason: "missing source node" };
  if (!targetNode) return { ok: false, reason: "missing target node" };

  let sourceType: string | undefined;
  if (sourceNode.type === SUBGRAPH_NODE_TYPE) {
    sourceType = subgraphPortType(doc, sourceNode.id, source.port, "output");
    if (sourceType === undefined) {
      return { ok: false, reason: `unbound subgraph output port ${source.port}` };
    }
  } else {
    const desc = registry.get(sourceNode.type);
    if (!desc) return { ok: false, reason: "unknown source node type" };
    const port = desc.outputs.find((p) => p.name === source.port);
    if (!port) {
      return { ok: false, reason: `unknown output port ${source.port} on ${desc.type}` };
    }
    sourceType = port.type;
  }

  let targetType: string | undefined;
  if (targetNode.type === SUBGRAPH_NODE_TYPE) {
    targetType = subgraphPortType(doc, targetNode.id, target.port, "input");
    if (targetType === undefined) {
      return { ok: false, reason: `unbound subgraph input port ${target.port}` };
    }
  } else {
    const desc = registry.get(targetNode.type);
    if (!desc) return { ok: false, reason: "unknown target node type" };
    const port = desc.inputs.find((p) => p.name === target.port);
    if (!port) {
      return { ok: false, reason: `unknown input port ${target.port} on ${desc.type}` };
    }
    targetType = port.type;
  }

  if (sourceType !== undefined && targetType !== undefined && sourceType !== targetType) {
    return { ok: false, reason: `port type mismatch: ${sourceType} -> ${targetType}` };
  }
  return { ok: true };
};
