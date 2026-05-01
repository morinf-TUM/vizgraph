import { describe, it, expect } from "vitest";
import { RunResultSchema } from "../../../src/document/runresult";

const validResult = (): unknown => ({
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
  ],
});

describe("RunResultSchema", () => {
  it("accepts the spec example shape", () => {
    expect(RunResultSchema.safeParse(validResult()).success).toBe(true);
  });

  it("rejects wrong version", () => {
    const bad = { ...(validResult() as object), version: 2 };
    expect(RunResultSchema.safeParse(bad).success).toBe(false);
  });

  it("requires at least one tick", () => {
    const bad = { version: 1, graph_id: null, ticks: [] };
    expect(RunResultSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts a string graph_id", () => {
    const ok = { ...(validResult() as object), graph_id: "abc" };
    expect(RunResultSchema.safeParse(ok).success).toBe(true);
  });

  it("rejects negative duration_ns on a node", () => {
    const bad: unknown = {
      version: 1,
      graph_id: null,
      ticks: [
        {
          tick: 0,
          started_at_ns: 0,
          duration_ns: 0,
          nodes: [{ id: 1, outputs: {}, duration_ns: -1, error: null }],
        },
      ],
    };
    expect(RunResultSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts a node with a string error message", () => {
    const ok: unknown = {
      version: 1,
      graph_id: null,
      ticks: [
        {
          tick: 0,
          started_at_ns: 0,
          duration_ns: 0,
          nodes: [{ id: 1, outputs: {}, duration_ns: 0, error: "runtime exception" }],
        },
      ],
    };
    expect(RunResultSchema.safeParse(ok).success).toBe(true);
  });

  it("supports multi-tick run results", () => {
    const ok: unknown = {
      version: 1,
      graph_id: null,
      ticks: [
        { tick: 0, started_at_ns: 0, duration_ns: 100, nodes: [] },
        { tick: 1, started_at_ns: 100, duration_ns: 100, nodes: [] },
      ],
    };
    expect(RunResultSchema.safeParse(ok).success).toBe(true);
  });
});
