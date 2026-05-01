import { describe, it, expect } from "vitest";
import { layoutGraph } from "../../../src/editor/autoLayout";
import { GraphDocumentSchema, type GraphDocument } from "../../../src/document/types";

const docOf = (input: unknown): GraphDocument => GraphDocumentSchema.parse(input);

describe("layoutGraph", () => {
  it("returns empty map for an empty graph", () => {
    const doc = docOf({ version: 1, graph: { nodes: [], edges: [] } });
    expect(layoutGraph(doc).size).toBe(0);
  });

  it("assigns a position for every node", () => {
    const doc = docOf({
      version: 1,
      graph: {
        nodes: [
          { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 1 } },
          { id: 2, type: "Add", position: { x: 0, y: 0 } },
          { id: 3, type: "Print", position: { x: 0, y: 0 } },
        ],
        edges: [
          {
            id: "e1",
            source: { node: 1, port: "out" },
            target: { node: 2, port: "a" },
          },
          {
            id: "e2",
            source: { node: 2, port: "sum" },
            target: { node: 3, port: "in" },
          },
        ],
      },
    });
    const positions = layoutGraph(doc);
    expect(positions.size).toBe(3);
    // Left-to-right rankdir: source ranks come before target ranks.
    const x1 = positions.get(1)!.x;
    const x2 = positions.get(2)!.x;
    const x3 = positions.get(3)!.x;
    expect(x1).toBeLessThan(x2);
    expect(x2).toBeLessThan(x3);
  });
});
