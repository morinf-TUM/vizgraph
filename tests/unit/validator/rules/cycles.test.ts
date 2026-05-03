import { describe, it, expect } from "vitest";
import { checkCycles } from "../../../../src/validator/rules/cycles";
import { GraphDocumentSchema, type GraphDocument } from "../../../../src/document/types";
import { CODES } from "../../../../src/validator/codes";

const docWith = (nodes: unknown[], edges: unknown[]): GraphDocument =>
  GraphDocumentSchema.parse({ version: 1, graph: { nodes, edges } });

const N = (id: number) => ({
  id,
  type: "Print",
  position: { x: 0, y: 0 },
  parameters: {},
});

const E = (id: string, src: number, dst: number) => ({
  id,
  source: { node: src, port: "out" },
  target: { node: dst, port: "in" },
});

describe("checkCycles", () => {
  it("returns no diagnostics for an empty graph", () => {
    expect(checkCycles(docWith([], []).graph)).toEqual([]);
  });

  it("returns no diagnostics for an acyclic graph", () => {
    const doc = docWith([N(1), N(2), N(3)], [E("e1", 1, 2), E("e2", 2, 3), E("e3", 1, 3)]);
    expect(checkCycles(doc.graph)).toEqual([]);
  });

  it("emits CYCLE on a triangle 1->2->3->1", () => {
    const doc = docWith([N(1), N(2), N(3)], [E("e1", 1, 2), E("e2", 2, 3), E("e3", 3, 1)]);
    const diags = checkCycles(doc.graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]?.code).toBe(CODES.CYCLE);
    expect(diags[0]?.severity).toBe("error");
    expect(diags[0]?.edge_id).toBe("e3");
    expect(diags[0]?.message).toMatch(/1.*2.*3.*1/);
  });

  it("emits CYCLE on a two-node back-edge 1->2->1", () => {
    const doc = docWith([N(1), N(2)], [E("e1", 1, 2), E("e2", 2, 1)]);
    const diags = checkCycles(doc.graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]?.code).toBe(CODES.CYCLE);
    expect(diags[0]?.edge_id).toBe("e2");
  });

  it("emits one diagnostic per back-edge for two disjoint cycles", () => {
    const doc = docWith(
      [N(1), N(2), N(3), N(4)],
      [E("e1", 1, 2), E("e2", 2, 1), E("e3", 3, 4), E("e4", 4, 3)],
    );
    const diags = checkCycles(doc.graph);
    expect(diags).toHaveLength(2);
    expect(diags.map((d) => d.edge_id).sort()).toEqual(["e2", "e4"]);
  });

  it("skips self-loops (SELF_LOOP rule owns those)", () => {
    const doc = docWith([N(1)], [E("e1", 1, 1)]);
    expect(checkCycles(doc.graph)).toEqual([]);
  });

  it("skips edges whose source or target node is missing", () => {
    const doc = docWith([N(1)], [E("e1", 1, 99), E("e2", 99, 1)]);
    expect(checkCycles(doc.graph)).toEqual([]);
  });

  it("does not flag a DAG that has multiple paths between two nodes", () => {
    const doc = docWith(
      [N(1), N(2), N(3), N(4)],
      [E("e1", 1, 2), E("e2", 1, 3), E("e3", 2, 4), E("e4", 3, 4)],
    );
    expect(checkCycles(doc.graph)).toEqual([]);
  });
});
