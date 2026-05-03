import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useDocumentStore } from "../../../../src/editor/stores/documentStore";
import { useEditorStore } from "../../../../src/editor/stores/editorStore";
import { useClipboardStore } from "../../../../src/editor/stores/clipboardStore";
import { SUBGRAPH_NODE_TYPE } from "../../../../src/document/subgraph";
import type { GraphDocument } from "../../../../src/document/types";

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

describe("clipboardStore scoped to currentPath", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("copy and paste at depth 1 lands inside the inner sub-graph and leaves the root untouched", () => {
    const docStore = useDocumentStore();
    const editorStore = useEditorStore();
    const clipStore = useClipboardStore();

    docStore.replaceDocument(docWithEmptySubgraph(1));
    editorStore.setCurrentPath([1]);

    const a = docStore.addNode({ type: "Constant", position: { x: 0, y: 0 } });
    const b = docStore.addNode({ type: "Print", position: { x: 100, y: 0 } });
    docStore.addEdge({
      source: { node: a.id, port: "out" },
      target: { node: b.id, port: "in" },
    });

    editorStore.selectNode(a.id);
    editorStore.selectNode(b.id, true);
    expect(clipStore.copy()).toBe(true);

    const pasted = clipStore.paste();
    expect(pasted?.nodeIds).toHaveLength(2);
    expect(pasted?.edgeIds).toHaveLength(1);

    expect(docStore.nodes).toHaveLength(4);
    expect(docStore.edges).toHaveLength(2);

    expect(docStore.doc.graph.nodes).toHaveLength(1);
    expect(docStore.doc.graph.nodes[0]?.type).toBe(SUBGRAPH_NODE_TYPE);
    expect(docStore.doc.graph.edges).toEqual([]);
  });

  it("the same clip pastes at whichever level the user is viewing", () => {
    const docStore = useDocumentStore();
    const editorStore = useEditorStore();
    const clipStore = useClipboardStore();

    docStore.replaceDocument(docWithEmptySubgraph(1));
    editorStore.setCurrentPath([1]);

    const a = docStore.addNode({ type: "Constant", position: { x: 0, y: 0 } });
    const b = docStore.addNode({ type: "Print", position: { x: 100, y: 0 } });
    docStore.addEdge({
      source: { node: a.id, port: "out" },
      target: { node: b.id, port: "in" },
    });

    editorStore.selectNode(a.id);
    editorStore.selectNode(b.id, true);
    clipStore.copy();

    editorStore.setCurrentPath([]);
    clipStore.paste();

    // Root now contains the original Subgraph node plus the two pasted nodes
    // and one new edge between them. Inner graph still has only its original
    // two nodes and one edge.
    expect(docStore.doc.graph.nodes).toHaveLength(3);
    expect(docStore.doc.graph.edges).toHaveLength(1);

    const subgraphNode = docStore.doc.graph.nodes.find((n) => n.type === SUBGRAPH_NODE_TYPE);
    const innerDoc = (subgraphNode?.parameters as { children: GraphDocument }).children;
    expect(innerDoc.graph.nodes).toHaveLength(2);
    expect(innerDoc.graph.edges).toHaveLength(1);
  });
});
