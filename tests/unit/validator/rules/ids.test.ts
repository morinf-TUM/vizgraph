import { describe, it, expect } from "vitest";
import { checkDuplicateNodeIds } from "../../../../src/validator/rules/ids";
import { GraphDocumentSchema, type GraphDocument } from "../../../../src/document/types";
import { CODES } from "../../../../src/validator/codes";

const docWithNodes = (nodes: unknown[]): GraphDocument =>
  GraphDocumentSchema.parse({
    version: 1,
    graph: { nodes, edges: [] },
  });

describe("checkDuplicateNodeIds", () => {
  it("returns no diagnostics when all node IDs are unique", () => {
    const doc = docWithNodes([
      { id: 1, type: "Print", position: { x: 0, y: 0 } },
      { id: 2, type: "Print", position: { x: 0, y: 0 } },
      { id: 3, type: "Print", position: { x: 0, y: 0 } },
    ]);
    expect(checkDuplicateNodeIds(doc)).toEqual([]);
  });

  it("returns no diagnostics for an empty graph", () => {
    const doc = docWithNodes([]);
    expect(checkDuplicateNodeIds(doc)).toEqual([]);
  });

  it("emits one diagnostic per duplicated id value (not per occurrence)", () => {
    const doc = docWithNodes([
      { id: 1, type: "Print", position: { x: 0, y: 0 } },
      { id: 1, type: "Print", position: { x: 0, y: 0 } },
      { id: 1, type: "Print", position: { x: 0, y: 0 } },
    ]);
    const diags = checkDuplicateNodeIds(doc);
    expect(diags).toHaveLength(1);
    expect(diags[0]?.severity).toBe("error");
    expect(diags[0]?.code).toBe(CODES.DUPLICATE_NODE_ID);
    expect(diags[0]?.node_id).toBe(1);
  });

  it("emits one diagnostic per distinct duplicated id, in order of first occurrence", () => {
    const doc = docWithNodes([
      { id: 5, type: "Print", position: { x: 0, y: 0 } },
      { id: 2, type: "Print", position: { x: 0, y: 0 } },
      { id: 5, type: "Print", position: { x: 0, y: 0 } },
      { id: 2, type: "Print", position: { x: 0, y: 0 } },
      { id: 7, type: "Print", position: { x: 0, y: 0 } },
    ]);
    const diags = checkDuplicateNodeIds(doc);
    expect(diags.map((d) => d.node_id)).toEqual([5, 2]);
    for (const d of diags) {
      expect(d.severity).toBe("error");
      expect(d.code).toBe(CODES.DUPLICATE_NODE_ID);
    }
  });

  it("includes the duplicated id in the human-readable message", () => {
    const doc = docWithNodes([
      { id: 42, type: "Print", position: { x: 0, y: 0 } },
      { id: 42, type: "Print", position: { x: 0, y: 0 } },
    ]);
    const [diag] = checkDuplicateNodeIds(doc);
    expect(diag?.message).toMatch(/42/);
  });
});
