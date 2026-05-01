import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useDocumentStore } from "../../../../src/editor/stores/documentStore";

describe("documentStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts with an empty versioned document", () => {
    const store = useDocumentStore();
    expect(store.doc.version).toBe(1);
    expect(store.nodes).toEqual([]);
    expect(store.edges).toEqual([]);
  });

  it("addNode allocates the next id and pushes the node", () => {
    const store = useDocumentStore();
    const a = store.addNode({ type: "Constant", position: { x: 0, y: 0 } });
    const b = store.addNode({ type: "Print", position: { x: 100, y: 0 } });
    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
    expect(store.nodes).toHaveLength(2);
  });

  it("addNode preserves name and parameters when provided", () => {
    const store = useDocumentStore();
    const node = store.addNode({
      type: "Constant",
      position: { x: 0, y: 0 },
      name: "Two",
      parameters: { value: 2 },
    });
    expect(node.name).toBe("Two");
    expect(node.parameters).toEqual({ value: 2 });
  });

  it("removeNode cascades incident edges", () => {
    const store = useDocumentStore();
    const a = store.addNode({ type: "Constant", position: { x: 0, y: 0 } });
    const b = store.addNode({ type: "Add", position: { x: 100, y: 0 } });
    const c = store.addNode({ type: "Print", position: { x: 200, y: 0 } });
    store.addEdge({ source: { node: a.id, port: "out" }, target: { node: b.id, port: "a" } });
    store.addEdge({ source: { node: b.id, port: "sum" }, target: { node: c.id, port: "in" } });
    expect(store.edges).toHaveLength(2);
    store.removeNode(b.id);
    expect(store.nodes.map((n) => n.id)).toEqual([a.id, c.id]);
    expect(store.edges).toEqual([]);
  });

  it("moveNode updates the node's position", () => {
    const store = useDocumentStore();
    const node = store.addNode({ type: "Print", position: { x: 0, y: 0 } });
    store.moveNode(node.id, { x: 50, y: 75 });
    expect(store.nodes[0]?.position).toEqual({ x: 50, y: 75 });
  });

  it("renameNode sets and clears the name", () => {
    const store = useDocumentStore();
    const node = store.addNode({ type: "Print", position: { x: 0, y: 0 } });
    store.renameNode(node.id, "Output");
    expect(store.nodes[0]?.name).toBe("Output");
    store.renameNode(node.id, undefined);
    expect(store.nodes[0]?.name).toBeUndefined();
  });

  it("updateParameter merges into the parameters object", () => {
    const store = useDocumentStore();
    const node = store.addNode({
      type: "Constant",
      position: { x: 0, y: 0 },
      parameters: { value: 1 },
    });
    store.updateParameter(node.id, "value", 7);
    expect(store.nodes[0]?.parameters).toEqual({ value: 7 });
    store.updateParameter(node.id, "label", "x");
    expect(store.nodes[0]?.parameters).toEqual({ value: 7, label: "x" });
  });

  it("setFrequency assigns a positive number, null, or removes via undefined", () => {
    const store = useDocumentStore();
    const node = store.addNode({ type: "Print", position: { x: 0, y: 0 } });
    store.setFrequency(node.id, 60);
    expect(store.nodes[0]?.frequency_hz).toBe(60);
    store.setFrequency(node.id, null);
    expect(store.nodes[0]?.frequency_hz).toBeNull();
    store.setFrequency(node.id, undefined);
    expect(store.nodes[0]?.frequency_hz).toBeUndefined();
  });

  it("addEdge synthesises a deterministic id and stores endpoints", () => {
    const store = useDocumentStore();
    store.addNode({ type: "Constant", position: { x: 0, y: 0 } });
    store.addNode({ type: "Add", position: { x: 0, y: 0 } });
    const edge = store.addEdge({
      source: { node: 1, port: "out" },
      target: { node: 2, port: "a" },
    });
    expect(edge.id).toBe("e1_out__2_a");
    expect(store.edges).toHaveLength(1);
  });

  it("removeEdge deletes by id", () => {
    const store = useDocumentStore();
    store.addNode({ type: "Constant", position: { x: 0, y: 0 } });
    store.addNode({ type: "Print", position: { x: 0, y: 0 } });
    const edge = store.addEdge({
      source: { node: 1, port: "out" },
      target: { node: 2, port: "in" },
    });
    store.removeEdge(edge.id);
    expect(store.edges).toEqual([]);
  });

  it("setViewport assigns and clears the viewport", () => {
    const store = useDocumentStore();
    store.setViewport({ x: 10, y: 20, zoom: 1.5 });
    expect(store.viewport).toEqual({ x: 10, y: 20, zoom: 1.5 });
    store.setViewport(undefined);
    expect(store.viewport).toBeUndefined();
  });

  it("replaceDocument swaps the entire document", () => {
    const store = useDocumentStore();
    store.addNode({ type: "Print", position: { x: 0, y: 0 } });
    store.replaceDocument({
      version: 1,
      graph: {
        nodes: [{ id: 9, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 1 } }],
        edges: [],
      },
    });
    expect(store.nodes).toHaveLength(1);
    expect(store.nodes[0]?.id).toBe(9);
  });

  it("newDocument resets to empty", () => {
    const store = useDocumentStore();
    store.addNode({ type: "Print", position: { x: 0, y: 0 } });
    store.newDocument();
    expect(store.nodes).toEqual([]);
    expect(store.edges).toEqual([]);
  });
});
