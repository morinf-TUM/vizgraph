import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useCanvasOperations } from "../../../../src/editor/composables/useCanvasOperations";
import { useDocumentStore } from "../../../../src/editor/stores/documentStore";
import { useEditorStore } from "../../../../src/editor/stores/editorStore";

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
