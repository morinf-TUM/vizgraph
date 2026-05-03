import type { Graph } from "../../document/types";
import type { NodeTypeRegistry } from "../../registry/registry";
import {
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
} from "../../document/subgraph";
import { CODES } from "../codes";
import { warning, type Diagnostic } from "../diagnostics";

const incidentNodeIds = (graph: Graph): Set<number> => {
  const incident = new Set<number>();
  for (const edge of graph.edges) {
    incident.add(edge.source.node);
    incident.add(edge.target.node);
  }
  return incident;
};

export const checkIsolatedNodes = (graph: Graph, path: number[] = []): Diagnostic[] => {
  const incident = incidentNodeIds(graph);
  const diagnostics: Diagnostic[] = [];
  for (const node of graph.nodes) {
    if (
      node.type === SUBGRAPH_NODE_TYPE ||
      node.type === SUBGRAPH_INPUT_NODE_TYPE ||
      node.type === SUBGRAPH_OUTPUT_NODE_TYPE
    ) {
      continue;
    }
    if (!incident.has(node.id)) {
      diagnostics.push(
        warning({
          code: CODES.ISOLATED_NODE,
          message: `Node ${String(node.id)} is isolated (no edges in or out).`,
          node_id: node.id,
          ...(path.length > 0 ? { path } : {}),
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
  graph: Graph,
  path: number[] = [],
  registry: NodeTypeRegistry,
): Diagnostic[] => {
  const incident = incidentNodeIds(graph);
  const incomingByNode = new Map<number, Set<string>>();
  for (const edge of graph.edges) {
    let ports = incomingByNode.get(edge.target.node);
    if (!ports) {
      ports = new Set<string>();
      incomingByNode.set(edge.target.node, ports);
    }
    ports.add(edge.target.port);
  }

  const diagnostics: Diagnostic[] = [];
  for (const node of graph.nodes) {
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
            ...(path.length > 0 ? { path } : {}),
          }),
        );
      }
    }
  }
  return diagnostics;
};
