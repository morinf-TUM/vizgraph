import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useExecutionStore } from "../../../../src/editor/stores/executionStore";
import { RunResultSchema } from "../../../../src/document/runresult";

const sample = () =>
  RunResultSchema.parse({
    version: 1,
    graph_id: null,
    ticks: [
      {
        tick: 0,
        started_at_ns: 0,
        duration_ns: 12345,
        nodes: [
          { id: 3, outputs: { sum: 5 }, duration_ns: 12000, error: null },
          { id: 4, outputs: {}, duration_ns: 200, error: null },
        ],
      },
      {
        tick: 1,
        started_at_ns: 100,
        duration_ns: 200,
        nodes: [{ id: 3, outputs: { sum: 7 }, duration_ns: 200, error: null }],
      },
    ],
  });

describe("executionStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts in edit mode with no result", () => {
    const s = useExecutionStore();
    expect(s.mode).toBe("edit");
    expect(s.result).toBeUndefined();
    expect(s.tickCount).toBe(0);
    expect(s.currentTick).toBeUndefined();
    expect(s.overlayByLocalNodeId.size).toBe(0);
  });

  it("setResult flips mode to inspect, resets tickIndex to 0, and exposes overlays", () => {
    const s = useExecutionStore();
    s.setResult(sample());
    expect(s.mode).toBe("inspect");
    expect(s.tickIndex).toBe(0);
    expect(s.tickCount).toBe(2);
    expect(s.currentTick?.tick).toBe(0);
    expect(s.overlayByLocalNodeId.get(3)?.outputs).toEqual({ sum: 5 });
  });

  it("setTickIndex moves between ticks within bounds", () => {
    const s = useExecutionStore();
    s.setResult(sample());
    s.setTickIndex(1);
    expect(s.currentTick?.tick).toBe(1);
    expect(s.overlayByLocalNodeId.get(3)?.outputs).toEqual({ sum: 7 });
  });

  it("setTickIndex out of range is a no-op", () => {
    const s = useExecutionStore();
    s.setResult(sample());
    s.setTickIndex(99);
    expect(s.tickIndex).toBe(0);
    s.setTickIndex(-1);
    expect(s.tickIndex).toBe(0);
  });

  it("clearResult resets mode and tick state", () => {
    const s = useExecutionStore();
    s.setResult(sample());
    s.clearResult();
    expect(s.mode).toBe("edit");
    expect(s.result).toBeUndefined();
    expect(s.tickIndex).toBe(0);
    expect(s.overlayByLocalNodeId.size).toBe(0);
  });

  it("toggleMode flips edit <-> inspect", () => {
    const s = useExecutionStore();
    s.toggleMode();
    expect(s.mode).toBe("inspect");
    s.toggleMode();
    expect(s.mode).toBe("edit");
  });
});
