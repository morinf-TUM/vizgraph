import type { Comment, EdgeEndpoint, GraphEdge, GraphNode, Position } from "../../document/types";
import { defaultRegistry } from "../../registry/registry";
import {
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
  type SubgraphParameters,
} from "../../document/subgraph";
import { edgeIdFor } from "../../document/ids";
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

  // Commits the final positions of a drag gesture in a single history
  // transaction so multi-select drags undo as one step. VueFlow only emits
  // a usable position on drag-end via @node-drag-stop (its `position` field
  // on `nodes-change` is unset on dragstop and set during in-flight frames),
  // so this is the entry point the canvas funnels drag commits through.
  const commitDrag = (
    nodeMoves: ReadonlyArray<{ id: number; position: Position }>,
    commentMoves: ReadonlyArray<{ id: string; position: Position }>,
  ): void => {
    const nodeIds = new Set(docStore.nodes.map((n) => n.id));
    const commentIds = new Set(docStore.comments.map((c) => c.id));
    const nodes = nodeMoves.filter((m) => nodeIds.has(m.id));
    const comments = commentMoves.filter((m) => commentIds.has(m.id));
    const total = nodes.length + comments.length;
    if (total === 0) return;
    history.transact(total === 1 ? "Move" : `Move ${String(total)} items`, () => {
      for (const m of nodes) docStore.moveNode(m.id, m.position);
      for (const m of comments) docStore.moveComment(m.id, m.position);
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

    // Traverse to the parent graph BEFORE transact so we can bail out without
    // leaving a no-op snapshot on the undo stack.
    const parentPath = path.slice(0, -1);
    let parentGraph = docStore.doc.graph;
    for (const stepId of parentPath) {
      const stepNode = parentGraph.nodes.find((n) => n.id === stepId);
      const childDoc = stepNode ? (stepNode.parameters as SubgraphParameters).children : undefined;
      if (!childDoc) return;
      parentGraph = childDoc.graph;
    }
    // Bail out early if there are no outer edges to patch, avoiding an empty undo entry.
    const affectedEdges = parentGraph.edges.filter(
      (e) =>
        (isPseudoInput && e.target.node === subgraphNodeId && e.target.port === oldName) ||
        (isPseudoOutput && e.source.node === subgraphNodeId && e.source.port === oldName),
    );
    if (affectedEdges.length === 0) {
      updateParameter(id, "name", newName);
      return;
    }

    history.transact("Rename pseudo-port", () => {
      // 1. Update the inner node's parameters.name.
      docStore.updateParameter(id, "name", newName);
      // 2. Patch outer edges that reference the old port name on the enclosing
      //    Subgraph node. We mutate in-place rather than removeEdge/addEdge
      //    because those helpers are bound to currentLevelGraph (the inner graph);
      //    the parent graph is a deliberate exception to the normal pattern.
      for (const edge of affectedEdges) {
        if (isPseudoInput) {
          edge.target = { node: subgraphNodeId, port: newName };
          edge.id = edgeIdFor(
            edge.source.node,
            edge.source.port,
            edge.target.node,
            edge.target.port,
          );
        } else {
          edge.source = { node: subgraphNodeId, port: newName };
          edge.id = edgeIdFor(
            edge.source.node,
            edge.source.port,
            edge.target.node,
            edge.target.port,
          );
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

  // Anchor a new comment to a node so node moves drag the comment along.
  // The comment is offset from the node's top-right so it's visible without
  // overlapping the body of the node.
  const addCommentAttachedToNode = (nodeId: number, text = "New comment"): Comment | undefined => {
    const node = docStore.nodes.find((n) => n.id === nodeId);
    if (!node) return undefined;
    const position: Position = { x: node.position.x + 40, y: node.position.y - 60 };
    return history.transact("Add attached comment", () => {
      const c = docStore.addComment({ text, position, attachedTo: { node: nodeId } });
      editorStore.markDirty();
      return c;
    });
  };

  const detachComment = (id: string): void => {
    if (docStore.comments.findIndex((c) => c.id === id) < 0) return;
    history.transact("Detach comment", () => {
      docStore.detachComment(id);
      editorStore.markDirty();
    });
  };

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
    commitDrag,
    connect,
    checkConnection,
    removeEdge,
    removeSelected,
    updateParameter,
    renamePseudoPort,
    renameNode,
    addCommentAt,
    addCommentAttachedToNode,
    removeComment,
    moveComment,
    editCommentText,
    detachComment,
    enterSubgraph,
    exitToParent,
    groupSelection,
  };
};
