import { describe, expect, it, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useExecutionStore } from "../../../../src/editor/stores/executionStore";
import { useEditorStore } from "../../../../src/editor/stores/editorStore";
import { RunResultSchema } from "../../../../src/document/runresult";

describe("executionStore overlay scoped to currentPath", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("overlayByLocalNodeId returns only entries whose path matches currentPath", () => {
    const exec = useExecutionStore();
    const editor = useEditorStore();
    exec.setResult(
      RunResultSchema.parse({
        version: 1,
        graph_id: null,
        ticks: [
          {
            tick: 0,
            started_at_ns: 0,
            duration_ns: 1000,
            nodes: [
              { id: 10, path: [], outputs: { out: 7 }, duration_ns: 100, error: null },
              { id: 2, path: [11], outputs: { sum: 8 }, duration_ns: 100, error: null },
            ],
          },
        ],
      }),
    );
    editor.setCurrentPath([]);
    expect(exec.overlayByLocalNodeId.get(10)).toBeDefined();
    expect(exec.overlayByLocalNodeId.get(2)).toBeUndefined();
    editor.setCurrentPath([11]);
    expect(exec.overlayByLocalNodeId.get(2)).toBeDefined();
    expect(exec.overlayByLocalNodeId.get(10)).toBeUndefined();
  });
});
