import type { Comment, EdgeEndpoint, GraphEdge, GraphNode, Position } from "../../document/types";
import { defaultRegistry } from "../../registry/registry";
import { useDocumentStore } from "../stores/documentStore";
import { useEditorStore } from "../stores/editorStore";
import { useHistoryStore } from "../stores/historyStore";
import { canConnect, type ConnectCheck } from "../canConnect";

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

  return {
    addNodeAt,
    removeNode,
    moveNode,
    connect,
    checkConnection,
    removeEdge,
    removeSelected,
    updateParameter,
    renameNode,
    addCommentAt,
    removeComment,
    moveComment,
    editCommentText,
  };
};
