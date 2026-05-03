import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  type Comment,
  type EdgeEndpoint,
  type Graph,
  type GraphDocument,
  type GraphEdge,
  type GraphNode,
  type Position,
  type Viewport,
} from "../../document/types";
import { edgeIdFor, nextCommentIdInGraph, nextNodeIdInGraph } from "../../document/ids";
import { SUBGRAPH_NODE_TYPE } from "../../document/subgraph";
import { useEditorStore } from "./editorStore";

const emptyDocument = (): GraphDocument => ({
  version: 1,
  graph: { nodes: [], edges: [], comments: [] },
});

const resolveGraph = (rootDoc: GraphDocument, path: readonly number[]): Graph => {
  let g: Graph = rootDoc.graph;
  for (const id of path) {
    const node = g.nodes.find((n) => n.id === id);
    if (!node || node.type !== SUBGRAPH_NODE_TYPE) {
      throw new Error(`Path resolution failed at id ${String(id)}: not a Subgraph.`);
    }
    const child = (node.parameters as { children?: GraphDocument }).children;
    if (!child) {
      throw new Error(`Subgraph ${String(id)} has no children.`);
    }
    g = child.graph;
  }
  return g;
};

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

export interface AddCommentInput {
  text: string;
  position: Position;
  size?: { width: number; height: number };
  color?: string;
}

export const useDocumentStore = defineStore("document", () => {
  const doc = ref<GraphDocument>(emptyDocument());
  const editorStore = useEditorStore();

  const currentLevelGraph = computed<Graph>(() => resolveGraph(doc.value, editorStore.currentPath));

  const nodes = computed(() => currentLevelGraph.value.nodes);
  const edges = computed(() => currentLevelGraph.value.edges);
  const viewport = computed(() => currentLevelGraph.value.viewport);
  const comments = computed(() => currentLevelGraph.value.comments);

  const findNodeIndex = (id: number): number =>
    currentLevelGraph.value.nodes.findIndex((n) => n.id === id);

  const findEdgeIndex = (id: string): number =>
    currentLevelGraph.value.edges.findIndex((e) => e.id === id);

  const addNode = (input: AddNodeInput): GraphNode => {
    const graph = currentLevelGraph.value;
    const id = nextNodeIdInGraph(graph);
    const node: GraphNode = {
      id,
      type: input.type,
      position: input.position,
      parameters: input.parameters ?? {},
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.frequency_hz !== undefined ? { frequency_hz: input.frequency_hz } : {}),
    };
    graph.nodes.push(node);
    return node;
  };

  const removeNode = (id: number): void => {
    const graph = currentLevelGraph.value;
    const idx = graph.nodes.findIndex((n) => n.id === id);
    if (idx < 0) return;
    graph.nodes.splice(idx, 1);
    // Cascade: prune any edges incident to the removed node so the document
    // never holds dangling endpoints. The validator's MISSING_*_NODE rule
    // would flag them, but we prefer to keep the in-memory document
    // structurally clean.
    graph.edges = graph.edges.filter((e) => e.source.node !== id && e.target.node !== id);
  };

  const moveNode = (id: number, position: Position): void => {
    const idx = findNodeIndex(id);
    if (idx < 0) return;
    const node = currentLevelGraph.value.nodes[idx];
    if (!node) return;
    node.position = position;
  };

  const renameNode = (id: number, name: string | undefined): void => {
    const idx = findNodeIndex(id);
    if (idx < 0) return;
    const node = currentLevelGraph.value.nodes[idx];
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
    const node = currentLevelGraph.value.nodes[idx];
    if (!node) return;
    node.parameters = { ...node.parameters, [key]: value };
  };

  const setFrequency = (id: number, hz: number | null | undefined): void => {
    const idx = findNodeIndex(id);
    if (idx < 0) return;
    const node = currentLevelGraph.value.nodes[idx];
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
    currentLevelGraph.value.edges.push(edge);
    return edge;
  };

  const removeEdge = (id: string): void => {
    const idx = findEdgeIndex(id);
    if (idx < 0) return;
    currentLevelGraph.value.edges.splice(idx, 1);
  };

  const setViewport = (next: Viewport | undefined): void => {
    const graph = currentLevelGraph.value;
    if (next === undefined) {
      delete graph.viewport;
    } else {
      graph.viewport = next;
    }
  };

  const findCommentIndex = (id: string): number =>
    currentLevelGraph.value.comments.findIndex((c) => c.id === id);

  const addComment = (input: AddCommentInput): Comment => {
    const graph = currentLevelGraph.value;
    const id = nextCommentIdInGraph(graph);
    const comment: Comment = {
      id,
      text: input.text,
      position: input.position,
      ...(input.size !== undefined ? { size: input.size } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    };
    graph.comments.push(comment);
    return comment;
  };

  const removeComment = (id: string): void => {
    const idx = findCommentIndex(id);
    if (idx < 0) return;
    currentLevelGraph.value.comments.splice(idx, 1);
  };

  const moveComment = (id: string, position: Position): void => {
    const idx = findCommentIndex(id);
    if (idx < 0) return;
    const comment = currentLevelGraph.value.comments[idx];
    if (!comment) return;
    comment.position = position;
  };

  const updateComment = (id: string, patch: Partial<Omit<Comment, "id">>): void => {
    const idx = findCommentIndex(id);
    if (idx < 0) return;
    const comment = currentLevelGraph.value.comments[idx];
    if (!comment) return;
    if (patch.text !== undefined) comment.text = patch.text;
    if (patch.position !== undefined) comment.position = patch.position;
    if (patch.size !== undefined) comment.size = patch.size;
    if (patch.color !== undefined) comment.color = patch.color;
  };

  const replaceDocument = (next: GraphDocument): void => {
    doc.value = next;
  };

  const newDocument = (): void => {
    doc.value = emptyDocument();
  };

  return {
    doc,
    currentLevelGraph,
    nodes,
    edges,
    viewport,
    comments,
    addNode,
    removeNode,
    moveNode,
    renameNode,
    updateParameter,
    setFrequency,
    addEdge,
    removeEdge,
    setViewport,
    addComment,
    removeComment,
    moveComment,
    updateComment,
    replaceDocument,
    newDocument,
  };
});
