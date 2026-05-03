import type { Graph, GraphDocument } from "../document/types";
import { SUBGRAPH_NODE_TYPE } from "../document/subgraph";
import { defaultRegistry, type NodeTypeRegistry } from "../registry/registry";
import type { Diagnostic } from "./diagnostics";
import { checkDuplicateNodeIds, checkDuplicateEdgeIds } from "./rules/ids";
import { checkMissingEdgeEndpoints, checkSelfLoops } from "./rules/edges";
import {
  checkInvalidSourcePort,
  checkInvalidTargetPort,
  checkPortTypeMismatch,
} from "./rules/ports";
import {
  checkUnknownNodeTypes,
  checkMissingRequiredParameters,
  checkParameterTypeMismatch,
} from "./rules/params";
import { checkInvalidFrequency } from "./rules/freq";
import { checkCycles } from "./rules/cycles";
import { checkIsolatedNodes, checkUnconnectedInputs } from "./rules/warnings";
import { checkSubgraphSchema } from "./rules/subgraphSchema";
import { checkSubgraphPlacement } from "./rules/subgraphPlacement";
import { checkSubgraphPorts } from "./rules/subgraphPorts";
import { checkSubgraphConnectivity } from "./rules/subgraphConnectivity";
import { checkReservedNodeTypes } from "./rules/reservedNodeType";

// Errors first, warnings last. Within each band, structural rules (id and
// edge integrity) precede semantic rules (types, ports, parameters), and
// cycle detection comes after structural soundness so cycle messages
// reference resolvable edges only.
const runLevel = (graph: Graph, path: number[], registry: NodeTypeRegistry): Diagnostic[] => [
  ...checkDuplicateNodeIds(graph, path),
  ...checkDuplicateEdgeIds(graph, path),
  ...checkMissingEdgeEndpoints(graph, path),
  ...checkSelfLoops(graph, path),
  ...checkUnknownNodeTypes(graph, path, registry),
  ...checkMissingRequiredParameters(graph, path, registry),
  ...checkParameterTypeMismatch(graph, path, registry),
  ...checkInvalidFrequency(graph, path),
  ...checkInvalidSourcePort(graph, path, registry),
  ...checkInvalidTargetPort(graph, path, registry),
  ...checkPortTypeMismatch(graph, path, registry),
  ...checkCycles(graph, path),
  ...checkIsolatedNodes(graph, path),
  ...checkUnconnectedInputs(graph, path, registry),
  ...checkSubgraphSchema(graph, path),
  ...checkSubgraphPlacement(graph, path),
  ...checkSubgraphConnectivity(graph, path),
];

export const validate = (
  doc: GraphDocument,
  registry: NodeTypeRegistry = defaultRegistry(),
): Diagnostic[] => {
  const out: Diagnostic[] = [];
  out.push(...checkReservedNodeTypes(registry));
  // checkSubgraphPorts walks the doc tree itself (cross-level diagnostics
  // need parent + child context together). Per-level rules below cover
  // the rest of the recursion.
  out.push(...checkSubgraphPorts(doc, registry));

  const stack: Array<{ graph: Graph; path: number[] }> = [{ graph: doc.graph, path: [] }];
  while (stack.length > 0) {
    const { graph, path } = stack.pop()!;
    out.push(...runLevel(graph, path, registry));
    for (const node of graph.nodes) {
      if (node.type === SUBGRAPH_NODE_TYPE) {
        const params = node.parameters as { children?: GraphDocument };
        if (params.children) {
          stack.push({ graph: params.children.graph, path: [...path, node.id] });
        }
      }
    }
  }
  return out;
};
