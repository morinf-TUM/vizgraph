import { describe, it, expect } from "vitest";
import { GraphDocumentSchema } from "../../../src/document/types";

const validInput = (): unknown => ({
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
});

describe("GraphDocumentSchema", () => {
  it("accepts a minimally valid versioned document", () => {
    expect(GraphDocumentSchema.safeParse(validInput()).success).toBe(true);
  });

  it("rejects wrong version", () => {
    const bad = { version: 2, graph: { nodes: [], edges: [] } };
    expect(GraphDocumentSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a node missing position", () => {
    const bad: unknown = {
      version: 1,
      graph: {
        nodes: [{ id: 1, type: "Constant", parameters: { value: 0 } }],
        edges: [],
      },
    };
    expect(GraphDocumentSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a non-integer node id", () => {
    const bad: unknown = {
      version: 1,
      graph: {
        nodes: [{ id: 1.5, type: "Print", position: { x: 0, y: 0 }, parameters: {} }],
        edges: [],
      },
    };
    expect(GraphDocumentSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts frequency_hz as a positive number, null, or omitted", () => {
    const input: unknown = {
      version: 1,
      graph: {
        nodes: [
          { id: 1, type: "Print", position: { x: 0, y: 0 }, parameters: {}, frequency_hz: 60 },
          { id: 2, type: "Print", position: { x: 0, y: 0 }, parameters: {}, frequency_hz: null },
          { id: 3, type: "Print", position: { x: 0, y: 0 }, parameters: {} },
        ],
        edges: [],
      },
    };
    expect(GraphDocumentSchema.safeParse(input).success).toBe(true);
  });

  it("rejects a non-positive frequency_hz", () => {
    const bad: unknown = {
      version: 1,
      graph: {
        nodes: [
          { id: 1, type: "Print", position: { x: 0, y: 0 }, parameters: {}, frequency_hz: 0 },
        ],
        edges: [],
      },
    };
    expect(GraphDocumentSchema.safeParse(bad).success).toBe(false);
  });
});
