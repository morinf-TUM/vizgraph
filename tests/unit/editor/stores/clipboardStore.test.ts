import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useDocumentStore } from "../../../../src/editor/stores/documentStore";
import { useEditorStore } from "../../../../src/editor/stores/editorStore";
import { useHistoryStore } from "../../../../src/editor/stores/historyStore";
import { useClipboardStore } from "../../../../src/editor/stores/clipboardStore";
import { useCanvasOperations } from "../../../../src/editor/composables/useCanvasOperations";

describe("clipboardStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("copy with empty selection returns false and leaves clip empty", () => {
    const cb = useClipboardStore();
    expect(cb.copy()).toBe(false);
    expect(cb.hasClip).toBe(false);
  });

  it("copy captures selected nodes and the edges fully internal to the selection", () => {
    const ops = useCanvasOperations();
    const docStore = useDocumentStore();
    const editorStore = useEditorStore();
    const cb = useClipboardStore();

    const a = ops.addNodeAt("Constant", { x: 0, y: 0 })!;
    const b = ops.addNodeAt("Add", { x: 100, y: 0 })!;
    const c = ops.addNodeAt("Print", { x: 200, y: 0 })!;
    ops.connect({ node: a.id, port: "out" }, { node: b.id, port: "a" });
    ops.connect({ node: b.id, port: "sum" }, { node: c.id, port: "in" });

    editorStore.selectNode(a.id);
    editorStore.selectNode(b.id, true);
    expect(cb.copy()).toBe(true);
    expect(cb.clip?.nodes.map((n) => n.id)).toEqual([a.id, b.id]);
    // Only the a->b edge is internal; b->c crosses the boundary and is dropped.
    expect(cb.clip?.edges).toHaveLength(1);
    expect(cb.clip?.edges[0]?.source.node).toBe(a.id);
    expect(cb.clip?.edges[0]?.target.node).toBe(b.id);
    expect(docStore.nodes).toHaveLength(3);
  });

  it("paste re-allocates ids, regenerates edge ids, offsets positions, and selects the result", () => {
    const ops = useCanvasOperations();
    const docStore = useDocumentStore();
    const editorStore = useEditorStore();
    const cb = useClipboardStore();

    const a = ops.addNodeAt("Constant", { x: 10, y: 20 })!;
    const b = ops.addNodeAt("Print", { x: 110, y: 20 })!;
    ops.connect({ node: a.id, port: "out" }, { node: b.id, port: "in" });

    editorStore.selectNode(a.id);
    editorStore.selectNode(b.id, true);
    cb.copy();

    const pasted = cb.paste();
    expect(pasted).toBeDefined();
    expect(pasted?.nodeIds).toHaveLength(2);
    expect(pasted?.edgeIds).toHaveLength(1);

    // Original ids stay 1, 2; pasted ids are 3, 4.
    expect(docStore.nodes.map((n) => n.id)).toEqual([1, 2, 3, 4]);
    // Edge id is regenerated against the new endpoint ids, so it differs from
    // the source edge id.
    expect(docStore.edges.map((e) => e.id)).toEqual(["e1_out__2_in", "e3_out__4_in"]);
    // Positions are offset.
    expect(docStore.nodes[2]?.position).toEqual({ x: 40, y: 50 });
    expect(docStore.nodes[3]?.position).toEqual({ x: 140, y: 50 });
    // Pasted nodes are now selected.
    expect([...editorStore.selectedNodeIds].sort()).toEqual([3, 4]);
  });

  it("paste without a clip is a no-op", () => {
    const cb = useClipboardStore();
    const docStore = useDocumentStore();
    expect(cb.paste()).toBeUndefined();
    expect(docStore.nodes).toEqual([]);
  });

  it("paste is a single transaction; one undo reverts the entire paste", () => {
    const ops = useCanvasOperations();
    const docStore = useDocumentStore();
    const editorStore = useEditorStore();
    const history = useHistoryStore();
    const cb = useClipboardStore();

    const a = ops.addNodeAt("Constant", { x: 0, y: 0 })!;
    editorStore.selectNode(a.id);
    cb.copy();
    cb.paste();
    expect(docStore.nodes).toHaveLength(2);
    expect(history.canUndo).toBe(true);
    history.undo();
    expect(docStore.nodes).toHaveLength(1);
  });

  it("cut copies and then removes the selection in a single transaction", () => {
    const ops = useCanvasOperations();
    const docStore = useDocumentStore();
    const editorStore = useEditorStore();
    const history = useHistoryStore();
    const cb = useClipboardStore();

    const a = ops.addNodeAt("Constant", { x: 0, y: 0 })!;
    ops.addNodeAt("Print", { x: 0, y: 0 });
    editorStore.selectNode(a.id);
    expect(cb.cut()).toBe(true);
    expect(docStore.nodes.map((n) => n.id)).toEqual([2]);
    expect(cb.hasClip).toBe(true);

    // After cut, paste should reproduce the cut content with a fresh id.
    cb.paste();
    expect(docStore.nodes.map((n) => n.type).sort()).toEqual(["Constant", "Print"]);

    // Undoing once reverts the paste; another undo reverts the cut.
    history.undo();
    expect(docStore.nodes.map((n) => n.id)).toEqual([2]);
    history.undo();
    expect(docStore.nodes.map((n) => n.id).sort()).toEqual([1, 2]);
  });
});
