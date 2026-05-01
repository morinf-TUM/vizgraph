import { describe, it, expect } from "vitest";
import { loadGraph } from "../../../src/serializer";

describe("loadGraph (dispatch)", () => {
  it("dispatches to versioned for { version, graph }", () => {
    const r = loadGraph({ version: 1, graph: { nodes: [], edges: [] } });
    expect(r.success).toBe(true);
  });

  it("dispatches to legacy for top-level nodes/edges without version", () => {
    const r = loadGraph({ nodes: [{ uid: 1, type: "Print" }], edges: [] });
    expect(r.success).toBe(true);
  });

  it("rejects a shape that's neither", () => {
    const r = loadGraph({ foo: 1 });
    expect(r.success).toBe(false);
  });
});
