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
