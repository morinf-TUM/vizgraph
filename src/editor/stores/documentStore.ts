import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  type EdgeEndpoint,
  type GraphDocument,
  type GraphEdge,
  type GraphNode,
  type Position,
  type Viewport,
} from "../../document/types";
import { edgeIdFor, nextNodeId } from "../../document/ids";

const emptyDocument = (): GraphDocument => ({
  version: 1,
  graph: { nodes: [], edges: [] },
});

export interface AddNodeInput {
  type: string;
  position: Position;
  name?: string;
  parameters?: Record<string, unknown>;
  frequency_hz?: number | null;
}

export interface AddEdgeInput {
  source: EdgeEndpoint;
  target: EdgeEndpoint;
}

export const useDocumentStore = defineStore("document", () => {
  const doc = ref<GraphDocument>(emptyDocument());

  const nodes = computed(() => doc.value.graph.nodes);
  const edges = computed(() => doc.value.graph.edges);
  const viewport = computed(() => doc.value.graph.viewport);

  const findNodeIndex = (id: number): number => doc.value.graph.nodes.findIndex((n) => n.id === id);

  const findEdgeIndex = (id: string): number => doc.value.graph.edges.findIndex((e) => e.id === id);

  const addNode = (input: AddNodeInput): GraphNode => {
    const id = nextNodeId(doc.value);
    const node: GraphNode = {
      id,
      type: input.type,
      position: input.position,
      parameters: input.parameters ?? {},
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.frequency_hz !== undefined ? { frequency_hz: input.frequency_hz } : {}),
    };
    doc.value.graph.nodes.push(node);
    return node;
  };

  const removeNode = (id: number): void => {
    const idx = findNodeIndex(id);
    if (idx < 0) return;
    doc.value.graph.nodes.splice(idx, 1);
    // Cascade: prune any edges incident to the removed node so the document
    // never holds dangling endpoints. The validator's MISSING_*_NODE rule
    // would flag them, but we prefer to keep the in-memory document
    // structurally clean.
    doc.value.graph.edges = doc.value.graph.edges.filter(
      (e) => e.source.node !== id && e.target.node !== id,
    );
  };

  const moveNode = (id: number, position: Position): void => {
    const idx = findNodeIndex(id);
    if (idx < 0) return;
    const node = doc.value.graph.nodes[idx];
    if (!node) return;
    node.position = position;
  };

  const renameNode = (id: number, name: string | undefined): void => {
    const idx = findNodeIndex(id);
    if (idx < 0) return;
    const node = doc.value.graph.nodes[idx];
    if (!node) return;
    if (name === undefined) {
      delete node.name;
    } else {
      node.name = name;
    }
  };

  const updateParameter = (id: number, key: string, value: unknown): void => {
    const idx = findNodeIndex(id);
    if (idx < 0) return;
    const node = doc.value.graph.nodes[idx];
    if (!node) return;
    node.parameters = { ...node.parameters, [key]: value };
  };

  const setFrequency = (id: number, hz: number | null | undefined): void => {
    const idx = findNodeIndex(id);
    if (idx < 0) return;
    const node = doc.value.graph.nodes[idx];
    if (!node) return;
    if (hz === undefined) {
      delete node.frequency_hz;
    } else {
      node.frequency_hz = hz;
    }
  };

  const addEdge = (input: AddEdgeInput): GraphEdge => {
    const edge: GraphEdge = {
      id: edgeIdFor(input.source.node, input.source.port, input.target.node, input.target.port),
      source: { ...input.source },
      target: { ...input.target },
    };
    doc.value.graph.edges.push(edge);
    return edge;
  };

  const removeEdge = (id: string): void => {
    const idx = findEdgeIndex(id);
    if (idx < 0) return;
    doc.value.graph.edges.splice(idx, 1);
  };

  const setViewport = (next: Viewport | undefined): void => {
    if (next === undefined) {
      delete doc.value.graph.viewport;
    } else {
      doc.value.graph.viewport = next;
    }
  };

  const replaceDocument = (next: GraphDocument): void => {
    doc.value = next;
  };

  const newDocument = (): void => {
    doc.value = emptyDocument();
  };

  return {
    doc,
    nodes,
    edges,
    viewport,
    addNode,
    removeNode,
    moveNode,
    renameNode,
    updateParameter,
    setFrequency,
    addEdge,
    removeEdge,
    setViewport,
    replaceDocument,
    newDocument,
  };
});
