import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useCanvasOperations } from "../../../../src/editor/composables/useCanvasOperations";
import { useDocumentStore } from "../../../../src/editor/stores/documentStore";
import { useEditorStore } from "../../../../src/editor/stores/editorStore";
import { useHistoryStore } from "../../../../src/editor/stores/historyStore";

describe("useCanvasOperations", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("addNodeAt creates a node with built-in defaults from the registry and marks dirty", () => {
    const ops = useCanvasOperations();
    const docStore = useDocumentStore();
    const editorStore = useEditorStore();
    const node = ops.addNodeAt("Constant", { x: 10, y: 20 });
    expect(node).toBeDefined();
    expect(node?.parameters).toEqual({ value: 0 });
    expect(docStore.nodes).toHaveLength(1);
    expect(editorStore.dirty).toBe(true);
  });

  it("addNodeAt returns undefined for an unknown type and does not mutate", () => {
    const ops = useCanvasOperations();
    const docStore = useDocumentStore();
    const editorStore = useEditorStore();
    expect(ops.addNodeAt("Mystery", { x: 0, y: 0 })).toBeUndefined();
    expect(docStore.nodes).toHaveLength(0);
    expect(editorStore.dirty).toBe(false);
  });

  it("connect adds a valid edge and marks dirty", () => {
    const ops = useCanvasOperations();
    const docStore = useDocumentStore();
    const editorStore = useEditorStore();
    ops.addNodeAt("Constant", { x: 0, y: 0 });
    ops.addNodeAt("Print", { x: 100, y: 0 });
    editorStore.markClean();
    const edge = ops.connect({ node: 1, port: "out" }, { node: 2, port: "in" });
    expect(edge).toBeDefined();
    expect(docStore.edges).toHaveLength(1);
    expect(editorStore.dirty).toBe(true);
  });

  it("connect rejects an invalid edge and does not mark dirty", () => {
    const ops = useCanvasOperations();
    const docStore = useDocumentStore();
    const editorStore = useEditorStore();
    ops.addNodeAt("Constant", { x: 0, y: 0 });
    ops.addNodeAt("Print", { x: 100, y: 0 });
    editorStore.markClean();
    const edge = ops.connect({ node: 1, port: "out" }, { node: 2, port: "ghost" });
    expect(edge).toBeUndefined();
    expect(docStore.edges).toHaveLength(0);
    expect(editorStore.dirty).toBe(false);
  });

  it("removeSelected deletes selected nodes and edges and clears selection", () => {
    const ops = useCanvasOperations();
    const docStore = useDocumentStore();
    const editorStore = useEditorStore();
    const a = ops.addNodeAt("Constant", { x: 0, y: 0 })!;
    const b = ops.addNodeAt("Print", { x: 0, y: 0 })!;
    const e = ops.connect({ node: a.id, port: "out" }, { node: b.id, port: "in" })!;
    editorStore.selectNode(a.id);
    editorStore.selectEdge(e.id, true);
    ops.removeSelected();
    expect(docStore.nodes.map((n) => n.id)).toEqual([b.id]);
    expect(docStore.edges).toEqual([]);
    expect(editorStore.hasSelection).toBe(false);
  });

  it("commitDrag persists final positions for multiple nodes in one undo entry", () => {
    const ops = useCanvasOperations();
    const docStore = useDocumentStore();
    const editorStore = useEditorStore();
    const history = useHistoryStore();
    const a = ops.addNodeAt("Constant", { x: 0, y: 0 })!;
    const b = ops.addNodeAt("Print", { x: 100, y: 0 })!;
    editorStore.markClean();
    ops.commitDrag(
      [
        { id: a.id, position: { x: 50, y: 60 } },
        { id: b.id, position: { x: 200, y: 80 } },
      ],
      [],
    );
    expect(docStore.nodes.find((n) => n.id === a.id)?.position).toEqual({ x: 50, y: 60 });
    expect(docStore.nodes.find((n) => n.id === b.id)?.position).toEqual({ x: 200, y: 80 });
    expect(editorStore.dirty).toBe(true);
    // One undo step reverts the whole multi-drag; both nodes return.
    history.undo();
    expect(docStore.nodes.find((n) => n.id === a.id)?.position).toEqual({ x: 0, y: 0 });
    expect(docStore.nodes.find((n) => n.id === b.id)?.position).toEqual({ x: 100, y: 0 });
  });

  it("commitDrag persists comment moves alongside node moves", () => {
    const ops = useCanvasOperations();
    const docStore = useDocumentStore();
    const a = ops.addNodeAt("Constant", { x: 0, y: 0 })!;
    const c = ops.addCommentAt("hello", { x: 10, y: 10 });
    ops.commitDrag(
      [{ id: a.id, position: { x: 7, y: 8 } }],
      [{ id: c.id, position: { x: 11, y: 12 } }],
    );
    expect(docStore.nodes.find((n) => n.id === a.id)?.position).toEqual({ x: 7, y: 8 });
    expect(docStore.comments.find((cc) => cc.id === c.id)?.position).toEqual({ x: 11, y: 12 });
  });

  it("commitDrag silently drops moves whose targets no longer exist", () => {
    const ops = useCanvasOperations();
    const docStore = useDocumentStore();
    const editorStore = useEditorStore();
    ops.addNodeAt("Constant", { x: 0, y: 0 });
    editorStore.markClean();
    ops.commitDrag(
      [{ id: 999, position: { x: 1, y: 1 } }],
      [{ id: "ghost", position: { x: 1, y: 1 } }],
    );
    expect(docStore.nodes[0]?.position).toEqual({ x: 0, y: 0 });
    expect(editorStore.dirty).toBe(false);
  });

  it("checkConnection mirrors canConnect without mutating", () => {
    const ops = useCanvasOperations();
    const docStore = useDocumentStore();
    ops.addNodeAt("Constant", { x: 0, y: 0 });
    ops.addNodeAt("Add", { x: 0, y: 0 });
    expect(ops.checkConnection({ node: 1, port: "out" }, { node: 2, port: "a" })).toEqual({
      ok: true,
    });
    expect(docStore.edges).toHaveLength(0);
  });
});
