import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useEditorStore } from "../../../../src/editor/stores/editorStore";

describe("editorStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts with empty selection, default viewport, and dirty=false", () => {
    const s = useEditorStore();
    expect(s.selectedNodeIds.size).toBe(0);
    expect(s.selectedEdgeIds.size).toBe(0);
    expect(s.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(s.dirty).toBe(false);
    expect(s.hasSelection).toBe(false);
  });

  it("selectNode replaces selection by default and clears edge selection", () => {
    const s = useEditorStore();
    s.selectEdge("e1");
    s.selectNode(1);
    expect([...s.selectedNodeIds]).toEqual([1]);
    expect(s.selectedEdgeIds.size).toBe(0);
  });

  it("selectNode additive=true accumulates", () => {
    const s = useEditorStore();
    s.selectNode(1);
    s.selectNode(2, true);
    expect([...s.selectedNodeIds].sort()).toEqual([1, 2]);
  });

  it("selectEdge replaces selection by default and clears node selection", () => {
    const s = useEditorStore();
    s.selectNode(1);
    s.selectEdge("e1");
    expect([...s.selectedEdgeIds]).toEqual(["e1"]);
    expect(s.selectedNodeIds.size).toBe(0);
  });

  it("toggleNodeSelection adds and removes", () => {
    const s = useEditorStore();
    s.toggleNodeSelection(1);
    expect(s.selectedNodeIds.has(1)).toBe(true);
    s.toggleNodeSelection(1);
    expect(s.selectedNodeIds.has(1)).toBe(false);
  });

  it("clearSelection empties both selection sets", () => {
    const s = useEditorStore();
    s.selectNode(1);
    s.selectEdge("e1", true);
    s.clearSelection();
    expect(s.hasSelection).toBe(false);
  });

  it("setViewport replaces the viewport", () => {
    const s = useEditorStore();
    s.setViewport({ x: 100, y: 50, zoom: 2 });
    expect(s.viewport).toEqual({ x: 100, y: 50, zoom: 2 });
  });

  it("markDirty / markClean toggle the flag", () => {
    const s = useEditorStore();
    s.markDirty();
    expect(s.dirty).toBe(true);
    s.markClean();
    expect(s.dirty).toBe(false);
  });
});
