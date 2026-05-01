import type { EdgeEndpoint, GraphEdge, GraphNode, Position } from "../../document/types";
import { defaultRegistry } from "../../registry/registry";
import { useDocumentStore } from "../stores/documentStore";
import { useEditorStore } from "../stores/editorStore";
import { canConnect, type ConnectCheck } from "../canConnect";

// Bridge layer between the canvas/UI and the document/editor stores. Every
// mutation routed through here flips the dirty flag; the file-IO composable
// is the only counterpart that calls markClean().
export const useCanvasOperations = () => {
  const docStore = useDocumentStore();
  const editorStore = useEditorStore();
  const registry = defaultRegistry();

  const addNodeAt = (type: string, position: Position): GraphNode | undefined => {
    const desc = registry.get(type);
    if (!desc) return undefined;
    const parameters: Record<string, unknown> = {};
    for (const [key, paramDesc] of Object.entries(desc.parameters)) {
      if (paramDesc.default !== undefined) parameters[key] = paramDesc.default;
    }
    const node = docStore.addNode({ type, position, parameters });
    editorStore.markDirty();
    return node;
  };

  const removeNode = (id: number): void => {
    docStore.removeNode(id);
    editorStore.markDirty();
  };

  const moveNode = (id: number, position: Position): void => {
    docStore.moveNode(id, position);
    editorStore.markDirty();
  };

  const connect = (source: EdgeEndpoint, target: EdgeEndpoint): GraphEdge | undefined => {
    const check = canConnect(docStore.doc, registry, source, target);
    if (!check.ok) return undefined;
    const edge = docStore.addEdge({ source, target });
    editorStore.markDirty();
    return edge;
  };

  const checkConnection = (source: EdgeEndpoint, target: EdgeEndpoint): ConnectCheck =>
    canConnect(docStore.doc, registry, source, target);

  const removeEdge = (id: string): void => {
    docStore.removeEdge(id);
    editorStore.markDirty();
  };

  const removeSelected = (): void => {
    for (const id of editorStore.selectedEdgeIds) docStore.removeEdge(id);
    for (const id of editorStore.selectedNodeIds) docStore.removeNode(id);
    if (editorStore.selectedNodeIds.size > 0 || editorStore.selectedEdgeIds.size > 0) {
      editorStore.clearSelection();
      editorStore.markDirty();
    }
  };

  const updateParameter = (id: number, key: string, value: unknown): void => {
    docStore.updateParameter(id, key, value);
    editorStore.markDirty();
  };

  const renameNode = (id: number, name: string | undefined): void => {
    docStore.renameNode(id, name);
    editorStore.markDirty();
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
  };
};
