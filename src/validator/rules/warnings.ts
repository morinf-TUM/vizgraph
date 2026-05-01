import type { GraphDocument } from "../../document/types";
import type { NodeTypeRegistry } from "../../registry/registry";
import { CODES } from "../codes";
import { warning, type Diagnostic } from "../diagnostics";

const incidentNodeIds = (doc: GraphDocument): Set<number> => {
  const incident = new Set<number>();
  for (const edge of doc.graph.edges) {
    incident.add(edge.source.node);
    incident.add(edge.target.node);
  }
  return incident;
};

export const checkIsolatedNodes = (doc: GraphDocument): Diagnostic[] => {
  const incident = incidentNodeIds(doc);
  const diagnostics: Diagnostic[] = [];
  for (const node of doc.graph.nodes) {
    if (!incident.has(node.id)) {
      diagnostics.push(
        warning({
          code: CODES.ISOLATED_NODE,
          message: `Node ${String(node.id)} is isolated (no edges in or out).`,
          node_id: node.id,
        }),
      );
    }
  }
  return diagnostics;
};

// Spec §8: declared inputs have no per-port required flag, so all declared
// inputs are treated as required. ISOLATED_NODE owns the no-edges-at-all
// case; this rule only fires on partly-connected nodes to avoid duplicate
// noise. UNKNOWN_NODE_TYPE owns nodes whose type isn't in the registry.
export const checkUnconnectedInputs = (
  doc: GraphDocument,
  registry: NodeTypeRegistry,
): Diagnostic[] => {
  const incident = incidentNodeIds(doc);
  const incomingByNode = new Map<number, Set<string>>();
  for (const edge of doc.graph.edges) {
    let ports = incomingByNode.get(edge.target.node);
    if (!ports) {
      ports = new Set<string>();
      incomingByNode.set(edge.target.node, ports);
    }
    ports.add(edge.target.port);
  }

  const diagnostics: Diagnostic[] = [];
  for (const node of doc.graph.nodes) {
    if (!incident.has(node.id)) continue;
    const desc = registry.get(node.type);
    if (!desc) continue;
    const connected = incomingByNode.get(node.id) ?? new Set<string>();
    for (const port of desc.inputs) {
      if (!connected.has(port.name)) {
        diagnostics.push(
          warning({
            code: CODES.UNCONNECTED_INPUT,
            message: `Node ${String(node.id)} of type ${desc.type} has no edge into input port ${port.name}.`,
            node_id: node.id,
            field: `inputs.${port.name}`,
          }),
        );
      }
    }
  }
  return diagnostics;
};
