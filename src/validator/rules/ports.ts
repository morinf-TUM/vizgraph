import type { Graph, GraphEdge, GraphNode } from "../../document/types";
import type { NodeTypeRegistry } from "../../registry/registry";
import type { NodeTypeDescription, PortDescription } from "../../registry/types";
import { SUBGRAPH_NODE_TYPE } from "../../document/subgraph";
import { CODES } from "../codes";
import { error, type Diagnostic } from "../diagnostics";

// All three rules silently skip edges whose endpoints are missing or whose
// node type is unknown. Those failures have their own dedicated diagnostics
// (MISSING_SOURCE/TARGET_NODE in edges.ts, UNKNOWN_NODE_TYPE in params.ts);
// re-emitting here would multi-count the same offense.

interface EdgeContext {
  edge: GraphEdge;
  sourceNode: GraphNode;
  targetNode: GraphNode;
  sourceType: NodeTypeDescription;
  targetType: NodeTypeDescription;
}

const eachResolvableEdge = function* (
  graph: Graph,
  registry: NodeTypeRegistry,
): Generator<EdgeContext> {
  const nodesById = new Map<number, GraphNode>();
  for (const n of graph.nodes) nodesById.set(n.id, n);

  for (const edge of graph.edges) {
    const sourceNode = nodesById.get(edge.source.node);
    const targetNode = nodesById.get(edge.target.node);
    if (!sourceNode || !targetNode) continue;
    // Subgraph nodes have dynamic ports validated by subgraphPorts.ts; skip them here.
    if (sourceNode.type === SUBGRAPH_NODE_TYPE || targetNode.type === SUBGRAPH_NODE_TYPE) continue;
    const sourceType = registry.get(sourceNode.type);
    const targetType = registry.get(targetNode.type);
    if (!sourceType || !targetType) continue;
    yield { edge, sourceNode, targetNode, sourceType, targetType };
  }
};

const findPort = (ports: readonly PortDescription[], name: string): PortDescription | undefined =>
  ports.find((p) => p.name === name);

export const checkInvalidSourcePort = (
  graph: Graph,
  path: number[] = [],
  registry: NodeTypeRegistry,
): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];
  for (const { edge, sourceNode, sourceType } of eachResolvableEdge(graph, registry)) {
    if (!findPort(sourceType.outputs, edge.source.port)) {
      diagnostics.push(
        error({
          code: CODES.INVALID_SOURCE_PORT,
          message: `Node ${String(sourceNode.id)} of type ${sourceType.type} has no output port named ${edge.source.port}.`,
          edge_id: edge.id,
          node_id: sourceNode.id,
          field: "source.port",
          ...(path.length > 0 ? { path } : {}),
        }),
      );
    }
  }
  return diagnostics;
};

export const checkInvalidTargetPort = (
  graph: Graph,
  path: number[] = [],
  registry: NodeTypeRegistry,
): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];
  for (const { edge, targetNode, targetType } of eachResolvableEdge(graph, registry)) {
    if (!findPort(targetType.inputs, edge.target.port)) {
      diagnostics.push(
        error({
          code: CODES.INVALID_TARGET_PORT,
          message: `Node ${String(targetNode.id)} of type ${targetType.type} has no input port named ${edge.target.port}.`,
          edge_id: edge.id,
          node_id: targetNode.id,
          field: "target.port",
          ...(path.length > 0 ? { path } : {}),
        }),
      );
    }
  }
  return diagnostics;
};

export const checkPortTypeMismatch = (
  graph: Graph,
  path: number[] = [],
  registry: NodeTypeRegistry,
): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];
  for (const { edge, sourceType, targetType } of eachResolvableEdge(graph, registry)) {
    const sourcePort = findPort(sourceType.outputs, edge.source.port);
    const targetPort = findPort(targetType.inputs, edge.target.port);
    if (!sourcePort || !targetPort) continue;
    if (sourcePort.type === undefined || targetPort.type === undefined) continue;
    if (sourcePort.type !== targetPort.type) {
      diagnostics.push(
        error({
          code: CODES.PORT_TYPE_MISMATCH,
          message: `Edge ${edge.id} connects ${sourceType.type}.${sourcePort.name} (${sourcePort.type}) to ${targetType.type}.${targetPort.name} (${targetPort.type}).`,
          edge_id: edge.id,
          ...(path.length > 0 ? { path } : {}),
        }),
      );
    }
  }
  return diagnostics;
};
