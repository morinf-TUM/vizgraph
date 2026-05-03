import type { Graph, GraphDocument, GraphNode } from "../../document/types";
import {
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
} from "../../document/subgraph";
import type { NodeTypeRegistry } from "../../registry/registry";
import { CODES } from "../codes";
import { error, type Diagnostic } from "../diagnostics";

const childGraph = (subgraphNode: GraphNode): Graph | null => {
  const params = subgraphNode.parameters as { children?: GraphDocument };
  return params.children?.graph ?? null;
};

const portTypeOfRegular = (
  registry: NodeTypeRegistry,
  node: GraphNode,
  port: string,
  direction: "out" | "in",
): string | undefined => {
  const desc = registry.get(node.type);
  if (!desc) return undefined;
  const list = direction === "out" ? desc.outputs : desc.inputs;
  return list.find((p) => p.name === port)?.type;
};

// Walks the document tree and accumulates diagnostics for all three port rules.
export const checkSubgraphPorts = (
  doc: GraphDocument,
  registry: NodeTypeRegistry,
): Diagnostic[] => {
  const out: Diagnostic[] = [];
  walk(doc.graph, [], registry, out);
  return out;
};

const walk = (
  graph: Graph,
  path: number[],
  registry: NodeTypeRegistry,
  out: Diagnostic[],
): void => {
  // Outer-face port ids project onto a shared namespace, so a
  // SubgraphInput and a SubgraphOutput sharing parameters.name collide.
  const seenNames = new Map<string, number>();
  for (const node of graph.nodes) {
    if (node.type !== SUBGRAPH_INPUT_NODE_TYPE && node.type !== SUBGRAPH_OUTPUT_NODE_TYPE) {
      continue;
    }
    const name = (node.parameters as { name?: string }).name;
    if (name === undefined) continue;
    if (seenNames.has(name)) {
      out.push(
        error({
          code: CODES.PSEUDO_NODE_DUPLICATE_NAME,
          message: `Pseudo-node name "${name}" is used by more than one ${SUBGRAPH_INPUT_NODE_TYPE}/${SUBGRAPH_OUTPUT_NODE_TYPE} at this level.`,
          node_id: node.id,
          field: "parameters.name",
          ...(path.length > 0 ? { path } : {}),
        }),
      );
    } else {
      seenNames.set(name, node.id);
    }
  }

  // For every edge at this level whose endpoint is a Subgraph node, verify
  // the pseudo-node binding and (if both sides type-known) compare types.
  for (const edge of graph.edges) {
    const srcNode = graph.nodes.find((n) => n.id === edge.source.node);
    const dstNode = graph.nodes.find((n) => n.id === edge.target.node);
    if (srcNode?.type === SUBGRAPH_NODE_TYPE) {
      const cg = childGraph(srcNode);
      if (cg) {
        const pseudo = cg.nodes.find(
          (n) =>
            n.type === SUBGRAPH_OUTPUT_NODE_TYPE &&
            (n.parameters as { name?: string }).name === edge.source.port,
        );
        if (!pseudo) {
          out.push(
            error({
              code: CODES.SUBGRAPH_PORT_UNBOUND,
              message: `Edge ${edge.id} source references port "${edge.source.port}" on Subgraph ${String(srcNode.id)} but no SubgraphOutput inside has that name.`,
              edge_id: edge.id,
              node_id: srcNode.id,
              field: "source.port",
              ...(path.length > 0 ? { path } : {}),
            }),
          );
        } else {
          const innerPortType = (pseudo.parameters as { portType?: string }).portType;
          if (
            dstNode &&
            dstNode.type !== SUBGRAPH_NODE_TYPE &&
            dstNode.type !== SUBGRAPH_INPUT_NODE_TYPE &&
            dstNode.type !== SUBGRAPH_OUTPUT_NODE_TYPE
          ) {
            const inType = portTypeOfRegular(registry, dstNode, edge.target.port, "in");
            if (innerPortType !== undefined && inType !== undefined && innerPortType !== inType) {
              out.push(
                error({
                  code: CODES.SUBGRAPH_PORT_TYPE_MISMATCH,
                  message: `Edge ${edge.id} crosses sub-graph boundary with mismatched types: ${innerPortType} -> ${inType}.`,
                  edge_id: edge.id,
                  ...(path.length > 0 ? { path } : {}),
                }),
              );
            }
          }
        }
      }
    }
    if (dstNode?.type === SUBGRAPH_NODE_TYPE) {
      const cg = childGraph(dstNode);
      if (cg) {
        const pseudo = cg.nodes.find(
          (n) =>
            n.type === SUBGRAPH_INPUT_NODE_TYPE &&
            (n.parameters as { name?: string }).name === edge.target.port,
        );
        if (!pseudo) {
          out.push(
            error({
              code: CODES.SUBGRAPH_PORT_UNBOUND,
              message: `Edge ${edge.id} target references port "${edge.target.port}" on Subgraph ${String(dstNode.id)} but no SubgraphInput inside has that name.`,
              edge_id: edge.id,
              node_id: dstNode.id,
              field: "target.port",
              ...(path.length > 0 ? { path } : {}),
            }),
          );
        } else {
          const innerPortType = (pseudo.parameters as { portType?: string }).portType;
          if (
            srcNode &&
            srcNode.type !== SUBGRAPH_NODE_TYPE &&
            srcNode.type !== SUBGRAPH_INPUT_NODE_TYPE &&
            srcNode.type !== SUBGRAPH_OUTPUT_NODE_TYPE
          ) {
            const outType = portTypeOfRegular(registry, srcNode, edge.source.port, "out");
            if (innerPortType !== undefined && outType !== undefined && innerPortType !== outType) {
              out.push(
                error({
                  code: CODES.SUBGRAPH_PORT_TYPE_MISMATCH,
                  message: `Edge ${edge.id} crosses sub-graph boundary with mismatched types: ${outType} -> ${innerPortType}.`,
                  edge_id: edge.id,
                  ...(path.length > 0 ? { path } : {}),
                }),
              );
            }
          }
        }
      }
    }
  }

  // Recurse into every Subgraph child.
  for (const node of graph.nodes) {
    if (node.type === SUBGRAPH_NODE_TYPE) {
      const cg = childGraph(node);
      if (cg) walk(cg, [...path, node.id], registry, out);
    }
  }
};
