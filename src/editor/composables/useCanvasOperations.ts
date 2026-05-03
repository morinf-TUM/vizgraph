import type { Comment, EdgeEndpoint, GraphEdge, GraphNode, Position } from "../../document/types";
import { defaultRegistry } from "../../registry/registry";
import {
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
} from "../../document/subgraph";
import { useDocumentStore } from "../stores/documentStore";
import { useEditorStore } from "../stores/editorStore";
import { useHistoryStore } from "../stores/historyStore";
import { canConnect, type ConnectCheck } from "../canConnect";
import { groupSelection as groupSelectionImpl } from "./groupSelection";

// Bridge layer between the canvas/UI and the document/editor stores. Every
// mutation routed through here flips the dirty flag and is wrapped in a
// historyStore.transact so Ctrl+Z reverts a single user action atomically.
// useFileIO is the only counterpart that calls markClean() and
// historyStore.clear().
export const useCanvasOperations = () => {
  const docStore = useDocumentStore();
  const editorStore = useEditorStore();
  const history = useHistoryStore();
  const registry = defaultRegistry();

  const addNodeAt = (type: string, position: Position): GraphNode | undefined => {
    const desc = registry.get(type);
    if (!desc) return undefined;
    return history.transact(`Add ${type}`, () => {
      const parameters: Record<string, unknown> = {};
      for (const [key, paramDesc] of Object.entries(desc.parameters)) {
        if (paramDesc.default !== undefined) parameters[key] = paramDesc.default;
      }
      const node = docStore.addNode({ type, position, parameters });
      editorStore.markDirty();
      return node;
    });
  };

  const removeNode = (id: number): void => {
    if (docStore.nodes.findIndex((n) => n.id === id) < 0) return;
    history.transact(`Remove node ${String(id)}`, () => {
      docStore.removeNode(id);
      editorStore.markDirty();
    });
  };

  const moveNode = (id: number, position: Position): void => {
    if (docStore.nodes.findIndex((n) => n.id === id) < 0) return;
    history.transact(`Move node ${String(id)}`, () => {
      docStore.moveNode(id, position);
      editorStore.markDirty();
    });
  };

  const connect = (source: EdgeEndpoint, target: EdgeEndpoint): GraphEdge | undefined => {
    const check = canConnect(docStore.doc, registry, source, target);
    if (!check.ok) return undefined;
    return history.transact("Connect", () => {
      const edge = docStore.addEdge({ source, target });
      editorStore.markDirty();
      return edge;
    });
  };

  const checkConnection = (source: EdgeEndpoint, target: EdgeEndpoint): ConnectCheck =>
    canConnect(docStore.doc, registry, source, target);

  const removeEdge = (id: string): void => {
    if (docStore.edges.findIndex((e) => e.id === id) < 0) return;
    history.transact(`Remove edge ${id}`, () => {
      docStore.removeEdge(id);
      editorStore.markDirty();
    });
  };

  const removeSelected = (): void => {
    if (editorStore.selectedNodeIds.size === 0 && editorStore.selectedEdgeIds.size === 0) return;
    history.transact("Remove selected", () => {
      for (const id of editorStore.selectedEdgeIds) docStore.removeEdge(id);
      for (const id of editorStore.selectedNodeIds) docStore.removeNode(id);
      editorStore.clearSelection();
      editorStore.markDirty();
    });
  };

  const updateParameter = (id: number, key: string, value: unknown): void => {
    if (docStore.nodes.findIndex((n) => n.id === id) < 0) return;
    history.transact(`Edit ${key}`, () => {
      docStore.updateParameter(id, key, value);
      editorStore.markDirty();
    });
  };

  // Rename a SubgraphInput or SubgraphOutput pseudo-node port.
  // In addition to updating parameters.name on the inner node, this patches
  // all edges at the parent level that reference the old port name on the
  // enclosing Subgraph node, keeping outer wiring consistent.
  const renamePseudoPort = (id: number, newName: string): void => {
    const path = editorStore.currentPath;
    if (path.length === 0) return; // must be inside a subgraph
    const node = docStore.nodes.find((n) => n.id === id);
    if (!node) return;
    const isPseudoInput = node.type === SUBGRAPH_INPUT_NODE_TYPE;
    const isPseudoOutput = node.type === SUBGRAPH_OUTPUT_NODE_TYPE;
    if (!isPseudoInput && !isPseudoOutput) return;
    const oldName = (node.parameters as { name?: string }).name ?? "";
    if (oldName === newName) return;
    const subgraphNodeId = path[path.length - 1]!;
    history.transact("Rename pseudo-port", () => {
      // 1. Update the inner node's parameters.name.
      docStore.updateParameter(id, "name", newName);
      // 2. Patch outer edges: walk the parent-level graph (one step up in path)
      //    and rewrite edge endpoints that reference the old port name on the
      //    enclosing Subgraph node.
      const parentPath = path.slice(0, -1);
      let parentGraph = docStore.doc.graph;
      for (const stepId of parentPath) {
        const stepNode = parentGraph.nodes.find((n) => n.id === stepId);
        const childDoc = stepNode
          ? (stepNode.parameters as { children?: { graph: typeof parentGraph } }).children
          : undefined;
        if (!childDoc) return;
        parentGraph = childDoc.graph;
      }
      for (const edge of parentGraph.edges) {
        if (isPseudoInput && edge.target.node === subgraphNodeId && edge.target.port === oldName) {
          edge.target = { node: subgraphNodeId, port: newName };
          edge.id = `${String(edge.source.node)}_${edge.source.port}__${String(edge.target.node)}_${edge.target.port}`;
        }
        if (isPseudoOutput && edge.source.node === subgraphNodeId && edge.source.port === oldName) {
          edge.source = { node: subgraphNodeId, port: newName };
          edge.id = `${String(edge.source.node)}_${edge.source.port}__${String(edge.target.node)}_${edge.target.port}`;
        }
      }
      editorStore.markDirty();
    });
  };

  const renameNode = (id: number, name: string | undefined): void => {
    if (docStore.nodes.findIndex((n) => n.id === id) < 0) return;
    history.transact("Rename node", () => {
      docStore.renameNode(id, name);
      editorStore.markDirty();
    });
  };

  const addCommentAt = (text: string, position: Position): Comment =>
    history.transact("Add comment", () => {
      const c = docStore.addComment({ text, position });
      editorStore.markDirty();
      return c;
    });

  const removeComment = (id: string): void => {
    if (docStore.comments.findIndex((c) => c.id === id) < 0) return;
    history.transact(`Remove comment ${id}`, () => {
      docStore.removeComment(id);
      editorStore.markDirty();
    });
  };

  const moveComment = (id: string, position: Position): void => {
    if (docStore.comments.findIndex((c) => c.id === id) < 0) return;
    history.transact(`Move comment ${id}`, () => {
      docStore.moveComment(id, position);
      editorStore.markDirty();
    });
  };

  const editCommentText = (id: string, text: string): void => {
    if (docStore.comments.findIndex((c) => c.id === id) < 0) return;
    history.transact("Edit comment", () => {
      docStore.updateComment(id, { text });
      editorStore.markDirty();
    });
  };

  const enterSubgraph = (id: number): void => {
    const node = docStore.currentLevelGraph.nodes.find((n) => n.id === id);
    if (!node || node.type !== SUBGRAPH_NODE_TYPE) return;
    editorStore.enterSubgraph(id);
  };

  const exitToParent = (): void => {
    editorStore.exitSubgraph();
  };

  const groupSelection = (): GraphNode | undefined =>
    groupSelectionImpl(docStore, editorStore, history);

  return {
    addNodeAt,
    removeNode,
    moveNode,
    connect,
    checkConnection,
    removeEdge,
    removeSelected,
    updateParameter,
    renamePseudoPort,
    renameNode,
    addCommentAt,
    removeComment,
    moveComment,
    editCommentText,
    enterSubgraph,
    exitToParent,
    groupSelection,
  };
};
