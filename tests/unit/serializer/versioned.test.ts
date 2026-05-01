import { describe, it, expect } from "vitest";
import { loadVersioned, saveVersioned } from "../../../src/serializer/versioned";
import type { GraphDocument } from "../../../src/document/types";

const doc: GraphDocument = {
  version: 1,
  graph: {
    nodes: [
      {
        id: 1,
        name: "Two",
        type: "Constant",
        position: { x: 0, y: 0 },
        parameters: { value: 2 },
      },
    ],
    edges: [],
    comments: [],
  },
};

describe("versioned serializer", () => {
  it("saveVersioned produces a JSON string parseable as the same document", () => {
    const json = saveVersioned(doc);
    const parsed = JSON.parse(json) as unknown;
    const reloaded = loadVersioned(parsed);
    expect(reloaded.success).toBe(true);
    if (reloaded.success) expect(reloaded.data).toEqual(doc);
  });

  it("loadVersioned rejects an object missing the version field", () => {
    const r = loadVersioned({ graph: { nodes: [], edges: [] } });
    expect(r.success).toBe(false);
  });

  it("loadVersioned rejects a wrong version", () => {
    const r = loadVersioned({ version: 99, graph: { nodes: [], edges: [] } });
    expect(r.success).toBe(false);
  });
});
