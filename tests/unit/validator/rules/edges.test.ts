import { describe, it, expect } from "vitest";
import { checkMissingEdgeEndpoints, checkSelfLoops } from "../../../../src/validator/rules/edges";
import { GraphDocumentSchema, type GraphDocument } from "../../../../src/document/types";
import { CODES } from "../../../../src/validator/codes";

const docWith = (nodes: unknown[], edges: unknown[]): GraphDocument =>
  GraphDocumentSchema.parse({ version: 1, graph: { nodes, edges } });

const N = (id: number, type = "Print") => ({
  id,
  type,
  position: { x: 0, y: 0 },
  parameters: type === "Constant" ? { value: 0 } : {},
});

describe("checkMissingEdgeEndpoints", () => {
  it("returns no diagnostics when both endpoints exist", () => {
    const doc = docWith(
      [N(1, "Constant"), N(2)],
      [{ id: "e1", source: { node: 1, port: "out" }, target: { node: 2, port: "in" } }],
    );
    expect(checkMissingEdgeEndpoints(doc.graph)).toEqual([]);
  });

  it("returns no diagnostics for an empty graph", () => {
    expect(checkMissingEdgeEndpoints(docWith([], []).graph)).toEqual([]);
  });

  it("emits MISSING_SOURCE_NODE when source.node is not in nodes[]", () => {
    const doc = docWith(
      [N(2)],
      [{ id: "e1", source: { node: 99, port: "out" }, target: { node: 2, port: "in" } }],
    );
    const diags = checkMissingEdgeEndpoints(doc.graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]?.code).toBe(CODES.MISSING_SOURCE_NODE);
    expect(diags[0]?.severity).toBe("error");
    expect(diags[0]?.edge_id).toBe("e1");
    expect(diags[0]?.node_id).toBe(99);
    expect(diags[0]?.field).toBe("source.node");
    expect(diags[0]?.message).toMatch(/99/);
  });

  it("emits MISSING_TARGET_NODE when target.node is not in nodes[]", () => {
    const doc = docWith(
      [N(1, "Constant")],
      [{ id: "e1", source: { node: 1, port: "out" }, target: { node: 77, port: "in" } }],
    );
    const diags = checkMissingEdgeEndpoints(doc.graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]?.code).toBe(CODES.MISSING_TARGET_NODE);
    expect(diags[0]?.edge_id).toBe("e1");
    expect(diags[0]?.node_id).toBe(77);
    expect(diags[0]?.field).toBe("target.node");
  });

  it("emits both diagnostics when both endpoints are missing on a single edge", () => {
    const doc = docWith(
      [],
      [{ id: "e1", source: { node: 5, port: "out" }, target: { node: 6, port: "in" } }],
    );
    const diags = checkMissingEdgeEndpoints(doc.graph);
    expect(diags.map((d) => d.code)).toEqual([
      CODES.MISSING_SOURCE_NODE,
      CODES.MISSING_TARGET_NODE,
    ]);
  });

  it("emits one diagnostic per offending edge (no per-edge dedup, even on the same missing id)", () => {
    const doc = docWith(
      [N(1, "Constant")],
      [
        { id: "e1", source: { node: 1, port: "out" }, target: { node: 99, port: "in" } },
        { id: "e2", source: { node: 1, port: "out" }, target: { node: 99, port: "in" } },
      ],
    );
    const diags = checkMissingEdgeEndpoints(doc.graph);
    expect(diags.map((d) => d.edge_id)).toEqual(["e1", "e2"]);
    for (const d of diags) {
      expect(d.code).toBe(CODES.MISSING_TARGET_NODE);
      expect(d.node_id).toBe(99);
    }
  });
});

describe("checkSelfLoops", () => {
  it("returns no diagnostics when no edge connects a node to itself", () => {
    const doc = docWith(
      [N(1, "Constant"), N(2)],
      [{ id: "e1", source: { node: 1, port: "out" }, target: { node: 2, port: "in" } }],
    );
    expect(checkSelfLoops(doc.graph)).toEqual([]);
  });

  it("emits SELF_LOOP per offending edge", () => {
    const doc = docWith(
      [N(1, "Constant")],
      [{ id: "e1", source: { node: 1, port: "out" }, target: { node: 1, port: "in" } }],
    );
    const diags = checkSelfLoops(doc.graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]?.code).toBe(CODES.SELF_LOOP);
    expect(diags[0]?.severity).toBe("error");
    expect(diags[0]?.edge_id).toBe("e1");
    expect(diags[0]?.node_id).toBe(1);
  });

  it("emits one diagnostic per self-looping edge in document order", () => {
    const doc = docWith(
      [N(1, "Constant"), N(2)],
      [
        { id: "eA", source: { node: 1, port: "out" }, target: { node: 1, port: "in" } },
        { id: "eOK", source: { node: 1, port: "out" }, target: { node: 2, port: "in" } },
        { id: "eB", source: { node: 2, port: "out" }, target: { node: 2, port: "in" } },
      ],
    );
    const diags = checkSelfLoops(doc.graph);
    expect(diags.map((d) => d.edge_id)).toEqual(["eA", "eB"]);
  });
});
