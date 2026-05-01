import { describe, it, expect } from "vitest";
import { checkDuplicateNodeIds, checkDuplicateEdgeIds } from "../../../../src/validator/rules/ids";
import { GraphDocumentSchema, type GraphDocument } from "../../../../src/document/types";
import { CODES } from "../../../../src/validator/codes";

const docWithNodes = (nodes: unknown[]): GraphDocument =>
  GraphDocumentSchema.parse({
    version: 1,
    graph: { nodes, edges: [] },
  });

const docWithEdges = (edges: unknown[]): GraphDocument =>
  GraphDocumentSchema.parse({
    version: 1,
    graph: {
      nodes: [
        { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 0 } },
        { id: 2, type: "Print", position: { x: 0, y: 0 } },
      ],
      edges,
    },
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

describe("checkDuplicateEdgeIds", () => {
  it("returns no diagnostics when all edge IDs are unique", () => {
    const doc = docWithEdges([
      { id: "e1", source: { node: 1, port: "out" }, target: { node: 2, port: "in" } },
      { id: "e2", source: { node: 1, port: "out" }, target: { node: 2, port: "in" } },
    ]);
    expect(checkDuplicateEdgeIds(doc)).toEqual([]);
  });

  it("returns no diagnostics for an empty graph", () => {
    const doc = docWithEdges([]);
    expect(checkDuplicateEdgeIds(doc)).toEqual([]);
  });

  it("emits one diagnostic per duplicated edge id (not per occurrence)", () => {
    const doc = docWithEdges([
      { id: "e1", source: { node: 1, port: "out" }, target: { node: 2, port: "in" } },
      { id: "e1", source: { node: 1, port: "out" }, target: { node: 2, port: "in" } },
      { id: "e1", source: { node: 1, port: "out" }, target: { node: 2, port: "in" } },
    ]);
    const diags = checkDuplicateEdgeIds(doc);
    expect(diags).toHaveLength(1);
    expect(diags[0]?.severity).toBe("error");
    expect(diags[0]?.code).toBe(CODES.DUPLICATE_EDGE_ID);
    expect(diags[0]?.edge_id).toBe("e1");
    expect(diags[0]?.node_id).toBeUndefined();
  });

  it("emits one diagnostic per distinct duplicated edge id, in order of first occurrence", () => {
    const doc = docWithEdges([
      { id: "eA", source: { node: 1, port: "out" }, target: { node: 2, port: "in" } },
      { id: "eB", source: { node: 1, port: "out" }, target: { node: 2, port: "in" } },
      { id: "eA", source: { node: 1, port: "out" }, target: { node: 2, port: "in" } },
      { id: "eB", source: { node: 1, port: "out" }, target: { node: 2, port: "in" } },
      { id: "eC", source: { node: 1, port: "out" }, target: { node: 2, port: "in" } },
    ]);
    const diags = checkDuplicateEdgeIds(doc);
    expect(diags.map((d) => d.edge_id)).toEqual(["eA", "eB"]);
    for (const d of diags) {
      expect(d.severity).toBe("error");
      expect(d.code).toBe(CODES.DUPLICATE_EDGE_ID);
    }
  });

  it("includes the duplicated edge id in the human-readable message", () => {
    const doc = docWithEdges([
      { id: "edge-x", source: { node: 1, port: "out" }, target: { node: 2, port: "in" } },
      { id: "edge-x", source: { node: 1, port: "out" }, target: { node: 2, port: "in" } },
    ]);
    const [diag] = checkDuplicateEdgeIds(doc);
    expect(diag?.message).toMatch(/edge-x/);
  });
});
