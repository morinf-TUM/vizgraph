import { describe, expect, it, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useCanvasOperations } from "../../../../src/editor/composables/useCanvasOperations";
import { useEditorStore } from "../../../../src/editor/stores/editorStore";
import { useDocumentStore } from "../../../../src/editor/stores/documentStore";

describe("enterSubgraph / exitToParent", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("pushes/pops currentPath for a valid Subgraph node", () => {
    const ops = useCanvasOperations();
    const doc = useDocumentStore();
    const editor = useEditorStore();
    doc.replaceDocument({
      version: 1,
      graph: {
        nodes: [
          {
            id: 11,
            type: "Subgraph",
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
    expect(editor.currentPath).toEqual([]);
    ops.enterSubgraph(11);
    expect(editor.currentPath).toEqual([11]);
    ops.exitToParent();
    expect(editor.currentPath).toEqual([]);
  });

  it("ignores enterSubgraph for a non-Subgraph node", () => {
    const ops = useCanvasOperations();
    const doc = useDocumentStore();
    const editor = useEditorStore();
    doc.replaceDocument({
      version: 1,
      graph: {
        nodes: [{ id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 0 } }],
        edges: [],
        comments: [],
      },
    });
    ops.enterSubgraph(1);
    expect(editor.currentPath).toEqual([]);
  });
});

describe("groupSelection", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("groupSelection turns 2 selected nodes into a Subgraph with one inner edge preserved and an Input pseudo-node for the external feeder", () => {
    const ops = useCanvasOperations();
    const doc = useDocumentStore();
    const editor = useEditorStore();
    doc.replaceDocument({
      version: 1,
      graph: {
        nodes: [
          { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 5 } },
          { id: 2, type: "Add", position: { x: 100, y: 0 }, parameters: {} },
          { id: 3, type: "Print", position: { x: 200, y: 0 }, parameters: {} },
        ],
        edges: [
          { id: "e1", source: { node: 1, port: "out" }, target: { node: 2, port: "a" } },
          { id: "e2", source: { node: 2, port: "sum" }, target: { node: 3, port: "in" } },
        ],
        comments: [],
      },
    });
    editor.selectedNodeIds = new Set([2]);
    ops.groupSelection();
    expect(doc.nodes).toHaveLength(3);
    const sg = doc.nodes.find((n) => n.type === "Subgraph");
    expect(sg).toBeDefined();
    const reroutedIn = doc.edges.find((e) => e.source.node === 1 && e.target.node === sg!.id);
    expect(reroutedIn).toBeDefined();
    const reroutedOut = doc.edges.find((e) => e.source.node === sg!.id && e.target.node === 3);
    expect(reroutedOut).toBeDefined();
    const inner = (sg!.parameters as { children: { graph: { nodes: { type: string }[] } } })
      .children.graph.nodes;
    expect(inner.map((n) => n.type).sort()).toEqual(["Add", "SubgraphInput", "SubgraphOutput"]);
  });

  it("dedups a single external feeder fanning to multiple internal targets into one SubgraphInput", () => {
    const ops = useCanvasOperations();
    const doc = useDocumentStore();
    const editor = useEditorStore();
    doc.replaceDocument({
      version: 1,
      graph: {
        nodes: [
          { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 5 } },
          { id: 2, type: "Add", position: { x: 100, y: 0 }, parameters: {} },
          { id: 3, type: "Add", position: { x: 100, y: 100 }, parameters: {} },
        ],
        edges: [
          { id: "e1", source: { node: 1, port: "out" }, target: { node: 2, port: "a" } },
          { id: "e2", source: { node: 1, port: "out" }, target: { node: 3, port: "a" } },
        ],
        comments: [],
      },
    });
    editor.selectedNodeIds = new Set([2, 3]);
    ops.groupSelection();
    expect(doc.nodes).toHaveLength(2);
    const sg = doc.nodes.find((n) => n.type === "Subgraph");
    expect(sg).toBeDefined();
    const reroutedIns = doc.edges.filter((e) => e.source.node === 1 && e.target.node === sg!.id);
    expect(reroutedIns).toHaveLength(1);
    expect(reroutedIns[0]!.target.port).toBe("in1");
    const innerGraph = (
      sg!.parameters as {
        children: {
          graph: {
            nodes: { id: number; type: string }[];
            edges: {
              source: { node: number; port: string };
              target: { node: number; port: string };
            }[];
          };
        };
      }
    ).children.graph;
    expect(innerGraph.nodes).toHaveLength(3);
    const pseudoIns = innerGraph.nodes.filter((n) => n.type === "SubgraphInput");
    expect(pseudoIns).toHaveLength(1);
    const pseudoId = pseudoIns[0]!.id;
    expect(innerGraph.edges).toHaveLength(2);
    expect(
      innerGraph.edges.every((e) => e.source.node === pseudoId && e.source.port === "out"),
    ).toBe(true);
    const innerTargets = innerGraph.edges
      .map((e) => `${String(e.target.node)}.${e.target.port}`)
      .sort();
    expect(innerTargets).toEqual(["2.a", "3.a"]);
  });

  it("creates no pseudo-nodes when the whole graph is selected", () => {
    const ops = useCanvasOperations();
    const doc = useDocumentStore();
    const editor = useEditorStore();
    doc.replaceDocument({
      version: 1,
      graph: {
        nodes: [
          { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 5 } },
          { id: 2, type: "Add", position: { x: 100, y: 0 }, parameters: {} },
          { id: 3, type: "Print", position: { x: 200, y: 0 }, parameters: {} },
        ],
        edges: [
          { id: "e1", source: { node: 1, port: "out" }, target: { node: 2, port: "a" } },
          { id: "e2", source: { node: 2, port: "sum" }, target: { node: 3, port: "in" } },
        ],
        comments: [],
      },
    });
    editor.selectedNodeIds = new Set([1, 2, 3]);
    ops.groupSelection();
    expect(doc.nodes).toHaveLength(1);
    const sg = doc.nodes[0]!;
    expect(sg.type).toBe("Subgraph");
    expect(doc.edges).toHaveLength(0);
    const innerGraph = (
      sg.parameters as {
        children: { graph: { nodes: { type: string }[]; edges: unknown[] } };
      }
    ).children.graph;
    expect(innerGraph.nodes).toHaveLength(3);
    expect(innerGraph.nodes.map((n) => n.type).sort()).toEqual(["Add", "Constant", "Print"]);
    expect(innerGraph.edges).toHaveLength(2);
  });
});
