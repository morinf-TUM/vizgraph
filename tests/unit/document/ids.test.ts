import { describe, it, expect } from "vitest";
import { nextNodeId, edgeIdFor } from "../../../src/document/ids";
import type { GraphDocument } from "../../../src/document/types";

const empty: GraphDocument = { version: 1, graph: { nodes: [], edges: [] } };
const someDoc: GraphDocument = {
  version: 1,
  graph: {
    nodes: [
      { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: {} },
      { id: 7, type: "Add", position: { x: 0, y: 0 }, parameters: {} },
      { id: 4, type: "Print", position: { x: 0, y: 0 }, parameters: {} },
    ],
    edges: [],
  },
};

describe("nextNodeId", () => {
  it("starts at 1 for an empty document", () => {
    expect(nextNodeId(empty)).toBe(1);
  });

  it("returns max(existing) + 1", () => {
    expect(nextNodeId(someDoc)).toBe(8);
  });

  it("is deterministic and pure", () => {
    const a = nextNodeId(someDoc);
    const b = nextNodeId(someDoc);
    expect(a).toBe(b);
  });
});

describe("edgeIdFor", () => {
  it("produces e<src>_<srcPort>__<dst>_<dstPort>", () => {
    expect(edgeIdFor(1, "out", 2, "a")).toBe("e1_out__2_a");
  });
});
