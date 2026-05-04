import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useDocumentStore } from "../../../../src/editor/stores/documentStore";
import { useEditorStore } from "../../../../src/editor/stores/editorStore";
import { SUBGRAPH_NODE_TYPE } from "../../../../src/document/subgraph";
import type { GraphDocument } from "../../../../src/document/types";

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
        comments: [],
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
    expect(store.comments).toEqual([]);
  });

  it("addComment allocates monotonic c1, c2, ... ids and pushes the comment", () => {
    const store = useDocumentStore();
    const a = store.addComment({ text: "hi", position: { x: 0, y: 0 } });
    const b = store.addComment({ text: "again", position: { x: 100, y: 0 } });
    expect(a.id).toBe("c1");
    expect(b.id).toBe("c2");
    expect(store.comments).toHaveLength(2);
  });

  it("addComment after a delete reissues the freed id (id allocator scans the live array's max)", () => {
    const store = useDocumentStore();
    store.addComment({ text: "a", position: { x: 0, y: 0 } });
    const b = store.addComment({ text: "b", position: { x: 0, y: 0 } });
    store.removeComment(b.id);
    const c = store.addComment({ text: "c", position: { x: 0, y: 0 } });
    // Comment ids are editor-internal (not referenced by external systems)
    // and we deliberately don't carry a monotonic counter on the schema —
    // re-using the freed slot is fine in practice.
    expect(c.id).toBe("c2");
  });

  it("moveComment updates position, updateComment patches text/size/color", () => {
    const store = useDocumentStore();
    const c = store.addComment({ text: "hi", position: { x: 0, y: 0 } });
    store.moveComment(c.id, { x: 50, y: 60 });
    expect(store.comments[0]?.position).toEqual({ x: 50, y: 60 });
    store.updateComment(c.id, { text: "edited", color: "#ff0000" });
    expect(store.comments[0]?.text).toBe("edited");
    expect(store.comments[0]?.color).toBe("#ff0000");
  });

  it("removeComment is a no-op for unknown ids", () => {
    const store = useDocumentStore();
    store.addComment({ text: "x", position: { x: 0, y: 0 } });
    store.removeComment("c-not-real");
    expect(store.comments).toHaveLength(1);
  });

  describe("anchored comments", () => {
    it("addComment persists the attachedTo field when provided", () => {
      const store = useDocumentStore();
      const node = store.addNode({ type: "Constant", position: { x: 0, y: 0 } });
      const c = store.addComment({
        text: "anchored",
        position: { x: 10, y: 10 },
        attachedTo: { node: node.id },
      });
      expect(c.attachedTo).toEqual({ node: node.id });
    });

    it("moveNode shifts attached comments by the same delta", () => {
      const store = useDocumentStore();
      const node = store.addNode({ type: "Constant", position: { x: 100, y: 100 } });
      store.addComment({
        text: "follows",
        position: { x: 140, y: 40 },
        attachedTo: { node: node.id },
      });
      store.addComment({ text: "free", position: { x: 0, y: 0 } });
      store.moveNode(node.id, { x: 250, y: 180 });
      // Anchored comment shifted by +150,+80; free-floating one unchanged.
      expect(store.comments[0]?.position).toEqual({ x: 290, y: 120 });
      expect(store.comments[1]?.position).toEqual({ x: 0, y: 0 });
    });

    it("removeNode detaches anchored comments without deleting them", () => {
      const store = useDocumentStore();
      const node = store.addNode({ type: "Constant", position: { x: 0, y: 0 } });
      store.addComment({
        text: "anchored",
        position: { x: 10, y: 10 },
        attachedTo: { node: node.id },
      });
      store.removeNode(node.id);
      expect(store.comments).toHaveLength(1);
      expect(store.comments[0]?.attachedTo).toBeUndefined();
      expect(store.comments[0]?.text).toBe("anchored");
    });

    it("detachComment clears attachedTo without otherwise touching the comment", () => {
      const store = useDocumentStore();
      const node = store.addNode({ type: "Constant", position: { x: 0, y: 0 } });
      const c = store.addComment({
        text: "x",
        position: { x: 10, y: 10 },
        attachedTo: { node: node.id },
      });
      store.detachComment(c.id);
      expect(store.comments[0]?.attachedTo).toBeUndefined();
      expect(store.comments[0]?.position).toEqual({ x: 10, y: 10 });
    });
  });

  describe("path-aware mutations (currentPath != [])", () => {
    const docWithEmptySubgraph = (subgraphId: number): GraphDocument => ({
      version: 1,
      graph: {
        nodes: [
          {
            id: subgraphId,
            type: SUBGRAPH_NODE_TYPE,
            position: { x: 0, y: 0 },
            parameters: {
              children: { version: 1, graph: { nodes: [], edges: [], comments: [] } },
            },
          },
        ],
        edges: [],
        comments: [],
      },
    });

    it("addNode targets the inner graph when currentPath addresses a Subgraph", () => {
      const store = useDocumentStore();
      const editor = useEditorStore();
      store.replaceDocument(docWithEmptySubgraph(1));
      editor.setCurrentPath([1]);

      const inner = store.addNode({ type: "Constant", position: { x: 10, y: 10 } });
      expect(inner.id).toBe(1); // inner graph is empty, so first id is 1

      // Outer graph stays untouched (it still has only the Subgraph node).
      expect(store.doc.graph.nodes).toHaveLength(1);
      expect(store.doc.graph.nodes[0]?.type).toBe(SUBGRAPH_NODE_TYPE);

      const subgraphNode = store.doc.graph.nodes[0];
      const childDoc = (subgraphNode?.parameters as { children: GraphDocument }).children;
      expect(childDoc.graph.nodes).toHaveLength(1);
      expect(childDoc.graph.nodes[0]?.type).toBe("Constant");

      // currentLevelGraph selectors (nodes/edges/comments) reflect the inner graph.
      expect(store.nodes).toHaveLength(1);
      expect(store.nodes[0]?.type).toBe("Constant");
    });

    it("removeNode at depth 1 cascades inner edges only", () => {
      const store = useDocumentStore();
      const editor = useEditorStore();
      store.replaceDocument(docWithEmptySubgraph(99));
      editor.setCurrentPath([99]);

      const a = store.addNode({ type: "Constant", position: { x: 0, y: 0 } });
      const b = store.addNode({ type: "Print", position: { x: 100, y: 0 } });
      store.addEdge({
        source: { node: a.id, port: "out" },
        target: { node: b.id, port: "in" },
      });
      expect(store.edges).toHaveLength(1);

      store.removeNode(a.id);
      expect(store.nodes.map((n) => n.id)).toEqual([b.id]);
      expect(store.edges).toEqual([]);

      // Outer graph still has just the Subgraph node and no edges.
      expect(store.doc.graph.edges).toEqual([]);
      expect(store.doc.graph.nodes).toHaveLength(1);
    });

    it("addComment targets the inner graph", () => {
      const store = useDocumentStore();
      const editor = useEditorStore();
      store.replaceDocument(docWithEmptySubgraph(1));
      editor.setCurrentPath([1]);

      const c = store.addComment({ text: "inner", position: { x: 5, y: 5 } });
      expect(c.id).toBe("c1");
      expect(store.comments).toHaveLength(1);
      expect(store.doc.graph.comments).toEqual([]);
    });

    it("throws when currentPath references a non-Subgraph node", () => {
      const store = useDocumentStore();
      const editor = useEditorStore();
      store.replaceDocument({
        version: 1,
        graph: {
          nodes: [{ id: 5, type: "Constant", position: { x: 0, y: 0 }, parameters: {} }],
          edges: [],
          comments: [],
        },
      });
      editor.setCurrentPath([5]);
      expect(() => store.addNode({ type: "Print", position: { x: 0, y: 0 } })).toThrow(
        /not a Subgraph/,
      );
    });
  });
});
