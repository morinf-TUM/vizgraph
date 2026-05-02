import type { EdgeEndpoint, Graph, GraphDocument, GraphNode } from "./types";
import {
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
} from "./subgraph";

export interface ResolvedEndpoint {
  node: number;
  port: string;
  path: number[];
}

const graphAt = (doc: GraphDocument, path: number[]): Graph | null => {
  let g: Graph = doc.graph;
  for (const subgraphId of path) {
    const node = g.nodes.find((n) => n.id === subgraphId);
    if (!node || node.type !== SUBGRAPH_NODE_TYPE) return null;
    const params = node.parameters as { children?: GraphDocument };
    if (!params.children) return null;
    g = params.children.graph;
  }
  return g;
};

const findNode = (graph: Graph, id: number): GraphNode | undefined =>
  graph.nodes.find((n) => n.id === id);

export const resolveSource = (
  doc: GraphDocument,
  path: number[],
  endpoint: EdgeEndpoint,
): ResolvedEndpoint | null => {
  const graph = graphAt(doc, path);
  if (!graph) return null;
  const node = findNode(graph, endpoint.node);
  if (!node) return null;

  if (node.type === SUBGRAPH_NODE_TYPE) {
    // Descend; find SubgraphOutput with matching name; recurse on that
    // pseudo-node's feeding edge inside.
    const childPath = [...path, node.id];
    const childGraph = graphAt(doc, childPath);
    if (!childGraph) return null;
    const pseudo = childGraph.nodes.find(
      (n) =>
        n.type === SUBGRAPH_OUTPUT_NODE_TYPE &&
        (n.parameters as { name?: string }).name === endpoint.port,
    );
    if (!pseudo) return null;
    const innerEdge = childGraph.edges.find(
      (e) => e.target.node === pseudo.id && e.target.port === endpoint.port,
    );
    if (!innerEdge) return null;
    return resolveSource(doc, childPath, innerEdge.source);
  }

  if (node.type === SUBGRAPH_INPUT_NODE_TYPE) {
    // Ascend: parent edge whose target is (parent Subgraph node, this pseudo's name).
    if (path.length === 0) return null;
    const parentPath = path.slice(0, -1);
    const parentSubgraphId = path[path.length - 1]!;
    const name = (node.parameters as { name?: string }).name;
    if (name === undefined) return null;
    const parentGraph = graphAt(doc, parentPath);
    if (!parentGraph) return null;
    const parentEdge = parentGraph.edges.find(
      (e) => e.target.node === parentSubgraphId && e.target.port === name,
    );
    if (!parentEdge) return null;
    return resolveSource(doc, parentPath, parentEdge.source);
  }

  return { node: endpoint.node, port: endpoint.port, path };
};

export const resolveTarget = (
  doc: GraphDocument,
  path: number[],
  endpoint: EdgeEndpoint,
): ResolvedEndpoint[] => {
  const graph = graphAt(doc, path);
  if (!graph) return [];
  const node = findNode(graph, endpoint.node);
  if (!node) return [];

  if (node.type === SUBGRAPH_NODE_TYPE) {
    const childPath = [...path, node.id];
    const childGraph = graphAt(doc, childPath);
    if (!childGraph) return [];
    const pseudo = childGraph.nodes.find(
      (n) =>
        n.type === SUBGRAPH_INPUT_NODE_TYPE &&
        (n.parameters as { name?: string }).name === endpoint.port,
    );
    if (!pseudo) return [];
    return childGraph.edges
      .filter((e) => e.source.node === pseudo.id && e.source.port === endpoint.port)
      .flatMap((e) => resolveTarget(doc, childPath, e.target));
  }

  if (node.type === SUBGRAPH_OUTPUT_NODE_TYPE) {
    if (path.length === 0) return [];
    const parentPath = path.slice(0, -1);
    const parentSubgraphId = path[path.length - 1]!;
    const name = (node.parameters as { name?: string }).name;
    if (name === undefined) return [];
    const parentGraph = graphAt(doc, parentPath);
    if (!parentGraph) return [];
    return parentGraph.edges
      .filter((e) => e.source.node === parentSubgraphId && e.source.port === name)
      .flatMap((e) => resolveTarget(doc, parentPath, e.target));
  }

  return [{ node: endpoint.node, port: endpoint.port, path }];
};

export const pathKey = (path: number[], localId: number): string =>
  path.length === 0 ? String(localId) : `${path.join("/")}/${String(localId)}`;
