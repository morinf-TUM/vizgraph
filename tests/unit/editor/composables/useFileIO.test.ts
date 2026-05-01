// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useDocumentStore } from "../../../../src/editor/stores/documentStore";
import { useEditorStore } from "../../../../src/editor/stores/editorStore";
import { useCanvasOperations } from "../../../../src/editor/composables/useCanvasOperations";
import { useFileIO } from "../../../../src/editor/composables/useFileIO";
import { saveVersioned } from "../../../../src/serializer/versioned";

describe("useFileIO", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("save -> open round-trips a built-from-scratch simple-add document", async () => {
    const docStore = useDocumentStore();
    const editorStore = useEditorStore();
    const ops = useCanvasOperations();
    const fileIO = useFileIO();

    // Build the simple-add graph end-to-end through the canvas operations.
    const a = ops.addNodeAt("Constant", { x: 0, y: 0 })!;
    const b = ops.addNodeAt("Constant", { x: 100, y: 0 })!;
    const c = ops.addNodeAt("Add", { x: 200, y: 0 })!;
    const d = ops.addNodeAt("Print", { x: 300, y: 0 })!;
    ops.updateParameter(a.id, "value", 2);
    ops.updateParameter(b.id, "value", 3);
    ops.connect({ node: a.id, port: "out" }, { node: c.id, port: "a" });
    ops.connect({ node: b.id, port: "out" }, { node: c.id, port: "b" });
    ops.connect({ node: c.id, port: "sum" }, { node: d.id, port: "in" });

    expect(editorStore.dirty).toBe(true);

    // Snapshot the current document; we can't compare ref identities after
    // replaceDocument so we serialize-and-parse to compare values only.
    const original = JSON.parse(saveVersioned(docStore.doc)) as unknown;

    // Build the same JSON the Save flow would emit, and feed it back through
    // open() as if the user picked it from disk.
    const json = saveVersioned(docStore.doc);
    const file = new File([json], "graph.json", { type: "application/json" });

    docStore.newDocument();
    editorStore.markDirty();
    expect(docStore.nodes).toHaveLength(0);

    const result = await fileIO.open(file);
    expect(result.ok).toBe(true);
    expect(editorStore.dirty).toBe(false);

    const reloaded = JSON.parse(saveVersioned(docStore.doc)) as unknown;
    expect(reloaded).toEqual(original);
  });

  it("open() returns an error for malformed JSON", async () => {
    const fileIO = useFileIO();
    const file = new File(["not json"], "x.json", { type: "application/json" });
    const result = await fileIO.open(file);
    expect(result.ok).toBe(false);
  });

  it("open() returns an error for JSON that fails schema validation", async () => {
    const fileIO = useFileIO();
    const file = new File(['{"version": 99}'], "x.json", { type: "application/json" });
    const result = await fileIO.open(file);
    expect(result.ok).toBe(false);
  });
});
