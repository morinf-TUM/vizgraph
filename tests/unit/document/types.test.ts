import { describe, it, expect } from "vitest";
import { GraphDocumentSchema } from "../../../src/document/types";

const valid = {
  version: 1,
  graph: {
    nodes: [
      { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 2 } },
      { id: 2, type: "Print", position: { x: 100, y: 0 }, parameters: {} },
    ],
    edges: [
      {
        id: "e1",
        source: { node: 1, port: "out" },
        target: { node: 2, port: "in" },
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  },
};

describe("GraphDocumentSchema", () => {
  it("accepts a minimally valid versioned document", () => {
    const r = GraphDocumentSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it("rejects wrong version", () => {
    const bad = { ...valid, version: 2 };
    const r = GraphDocumentSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("rejects a node missing position", () => {
    const bad = structuredClone(valid);
    delete (bad.graph.nodes[0] as { position?: unknown }).position;
    const r = GraphDocumentSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("rejects a non-integer node id", () => {
    const bad = structuredClone(valid);
    bad.graph.nodes[0]!.id = 1.5;
    const r = GraphDocumentSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("accepts frequency_hz as a positive number, null, or omitted", () => {
    const a = structuredClone(valid);
    a.graph.nodes[0] = { ...a.graph.nodes[0]!, frequency_hz: 60 };
    expect(GraphDocumentSchema.safeParse(a).success).toBe(true);

    const b = structuredClone(valid);
    b.graph.nodes[0] = { ...b.graph.nodes[0]!, frequency_hz: null };
    expect(GraphDocumentSchema.safeParse(b).success).toBe(true);
  });

  it("rejects a non-positive frequency_hz", () => {
    const bad = structuredClone(valid);
    bad.graph.nodes[0] = { ...bad.graph.nodes[0]!, frequency_hz: 0 };
    expect(GraphDocumentSchema.safeParse(bad).success).toBe(false);
  });
});
