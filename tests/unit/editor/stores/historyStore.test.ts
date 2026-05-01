import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useDocumentStore } from "../../../../src/editor/stores/documentStore";
import { useHistoryStore } from "../../../../src/editor/stores/historyStore";

describe("historyStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts with empty stacks; canUndo and canRedo are false", () => {
    const h = useHistoryStore();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });

  it("transact pushes the pre-state to the undo stack and returns the fn result", () => {
    const docStore = useDocumentStore();
    const h = useHistoryStore();
    const node = h.transact("Add Print", () =>
      docStore.addNode({ type: "Print", position: { x: 0, y: 0 } }),
    );
    expect(node.id).toBe(1);
    expect(h.canUndo).toBe(true);
    expect(h.canRedo).toBe(false);
  });

  it("undo restores the pre-state and pushes the post-state to the redo stack", () => {
    const docStore = useDocumentStore();
    const h = useHistoryStore();
    h.transact("Add Print", () => docStore.addNode({ type: "Print", position: { x: 0, y: 0 } }));
    expect(docStore.nodes).toHaveLength(1);
    expect(h.undo()).toBe(true);
    expect(docStore.nodes).toHaveLength(0);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(true);
  });

  it("redo replays the post-state and re-pushes it to the undo stack", () => {
    const docStore = useDocumentStore();
    const h = useHistoryStore();
    h.transact("Add Print", () => docStore.addNode({ type: "Print", position: { x: 0, y: 0 } }));
    h.undo();
    expect(h.redo()).toBe(true);
    expect(docStore.nodes).toHaveLength(1);
    expect(h.canUndo).toBe(true);
    expect(h.canRedo).toBe(false);
  });

  it("a new transact after undo clears the redo stack", () => {
    const docStore = useDocumentStore();
    const h = useHistoryStore();
    h.transact("A", () => docStore.addNode({ type: "Print", position: { x: 0, y: 0 } }));
    h.transact("B", () => docStore.addNode({ type: "Add", position: { x: 0, y: 0 } }));
    h.undo();
    expect(h.canRedo).toBe(true);
    h.transact("C", () =>
      docStore.addNode({ type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 0 } }),
    );
    expect(h.canRedo).toBe(false);
  });

  it("undo/redo with multiple transactions is sequential", () => {
    const docStore = useDocumentStore();
    const h = useHistoryStore();
    h.transact("A", () => docStore.addNode({ type: "Print", position: { x: 0, y: 0 } }));
    h.transact("B", () => docStore.addNode({ type: "Add", position: { x: 0, y: 0 } }));
    h.transact("C", () =>
      docStore.addNode({ type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 0 } }),
    );
    expect(docStore.nodes).toHaveLength(3);
    h.undo();
    h.undo();
    expect(docStore.nodes.map((n) => n.type)).toEqual(["Print"]);
    h.redo();
    expect(docStore.nodes.map((n) => n.type)).toEqual(["Print", "Add"]);
  });

  it("clear empties both stacks", () => {
    const docStore = useDocumentStore();
    const h = useHistoryStore();
    h.transact("A", () => docStore.addNode({ type: "Print", position: { x: 0, y: 0 } }));
    h.undo();
    h.clear();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });

  it("undo on an empty stack returns false and does not mutate", () => {
    const docStore = useDocumentStore();
    const h = useHistoryStore();
    expect(h.undo()).toBe(false);
    expect(docStore.nodes).toEqual([]);
  });

  it("preserves the entire document, not just the affected slice", () => {
    const docStore = useDocumentStore();
    const h = useHistoryStore();
    h.transact("seed", () => {
      docStore.addNode({ type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 1 } });
      docStore.addNode({ type: "Print", position: { x: 100, y: 0 } });
      docStore.addEdge({ source: { node: 1, port: "out" }, target: { node: 2, port: "in" } });
    });
    h.transact("Move 1", () => docStore.moveNode(1, { x: 999, y: 999 }));
    h.undo();
    const n1 = docStore.nodes.find((n) => n.id === 1);
    expect(n1?.position).toEqual({ x: 0, y: 0 });
    expect(docStore.edges).toHaveLength(1);
  });
});
