import { describe, it, expect } from "vitest";
import {
  checkIsolatedNodes,
  checkUnconnectedInputs,
} from "../../../../src/validator/rules/warnings";
import { GraphDocumentSchema, type GraphDocument } from "../../../../src/document/types";
import { CODES } from "../../../../src/validator/codes";
import { defaultRegistry } from "../../../../src/registry/registry";

const docWith = (nodes: unknown[], edges: unknown[]): GraphDocument =>
  GraphDocumentSchema.parse({ version: 1, graph: { nodes, edges } });

const N = (id: number, type: string) => ({
  id,
  type,
  position: { x: 0, y: 0 },
  parameters: type === "Constant" ? { value: 0 } : {},
});

const E = (id: string, src: number, dst: number, srcPort = "out", dstPort = "in") => ({
  id,
  source: { node: src, port: srcPort },
  target: { node: dst, port: dstPort },
});

const reg = defaultRegistry();

describe("checkIsolatedNodes", () => {
  it("returns no diagnostics for an empty graph", () => {
    expect(checkIsolatedNodes(docWith([], []).graph)).toEqual([]);
  });

  it("emits ISOLATED_NODE warning for a node with no incident edges", () => {
    const doc = docWith([N(1, "Constant")], []);
    const diags = checkIsolatedNodes(doc.graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]?.code).toBe(CODES.ISOLATED_NODE);
    expect(diags[0]?.severity).toBe("warning");
    expect(diags[0]?.node_id).toBe(1);
  });

  it("does not flag nodes with at least one incident edge", () => {
    const doc = docWith([N(1, "Constant"), N(2, "Print")], [E("e1", 1, 2)]);
    expect(checkIsolatedNodes(doc.graph)).toEqual([]);
  });

  it("flags only the isolated node in a mixed graph", () => {
    const doc = docWith([N(1, "Constant"), N(2, "Print"), N(3, "Print")], [E("e1", 1, 2)]);
    const diags = checkIsolatedNodes(doc.graph);
    expect(diags.map((d) => d.node_id)).toEqual([3]);
  });

  it("does not flag a node whose only edge is a self-loop", () => {
    const doc = docWith([N(1, "Print")], [E("e1", 1, 1, "in", "in")]);
    expect(checkIsolatedNodes(doc.graph)).toEqual([]);
  });

  it("does not emit ISOLATED_NODE for a Subgraph container alone", () => {
    const doc = docWith(
      [{ id: 11, type: "Subgraph", position: { x: 0, y: 0 }, parameters: {} }],
      [],
    );
    const out = checkIsolatedNodes(doc.graph);
    expect(out.find((d) => d.code === CODES.ISOLATED_NODE)).toBeUndefined();
  });

  it("does not emit ISOLATED_NODE for SubgraphInput / SubgraphOutput pseudo-nodes", () => {
    const doc = docWith(
      [
        {
          id: 1,
          type: "SubgraphInput",
          position: { x: 0, y: 0 },
          parameters: { name: "x", portType: "int" },
        },
        {
          id: 2,
          type: "SubgraphOutput",
          position: { x: 0, y: 50 },
          parameters: { name: "y", portType: "int" },
        },
      ],
      [],
    );
    const out = checkIsolatedNodes(doc.graph);
    expect(out.find((d) => d.code === CODES.ISOLATED_NODE)).toBeUndefined();
  });
});

describe("checkUnconnectedInputs", () => {
  it("returns no diagnostics for an empty graph", () => {
    expect(checkUnconnectedInputs(docWith([], []).graph, [], reg)).toEqual([]);
  });

  it("does not flag nodes with no declared inputs", () => {
    const doc = docWith([N(1, "Constant"), N(2, "Print")], [E("e1", 1, 2)]);
    expect(checkUnconnectedInputs(doc.graph, [], reg).filter((d) => d.node_id === 1)).toEqual([]);
  });

  it("does not flag a node when every declared input has an incoming edge", () => {
    const doc = docWith(
      [N(1, "Constant"), N(2, "Constant"), N(3, "Add")],
      [E("e1", 1, 3, "out", "a"), E("e2", 2, 3, "out", "b")],
    );
    expect(checkUnconnectedInputs(doc.graph, [], reg)).toEqual([]);
  });

  it("emits UNCONNECTED_INPUT for each declared input lacking an incoming edge on a non-isolated node", () => {
    const doc = docWith(
      [N(1, "Constant"), N(2, "Add"), N(3, "Print")],
      [
        // node 2 (Add) has only port "a" connected; "b" is unconnected. node 2
        // is not isolated because it has the e2 outgoing edge to node 3.
        E("e1", 1, 2, "out", "a"),
        E("e2", 2, 3, "sum", "in"),
      ],
    );
    const diags = checkUnconnectedInputs(doc.graph, [], reg);
    expect(diags).toHaveLength(1);
    expect(diags[0]?.code).toBe(CODES.UNCONNECTED_INPUT);
    expect(diags[0]?.severity).toBe("warning");
    expect(diags[0]?.node_id).toBe(2);
    expect(diags[0]?.field).toBe("inputs.b");
  });

  it("emits one diagnostic per unconnected input on a single node", () => {
    const doc = docWith(
      [N(1, "Add"), N(2, "Print")],
      // node 1 (Add) has neither input connected, but has outgoing edge.
      [E("e1", 1, 2, "sum", "in")],
    );
    const diags = checkUnconnectedInputs(doc.graph, [], reg);
    expect(diags.map((d) => d.field)).toEqual(["inputs.a", "inputs.b"]);
  });

  it("skips isolated nodes (ISOLATED_NODE rule owns those)", () => {
    const doc = docWith([N(1, "Add")], []);
    expect(checkUnconnectedInputs(doc.graph, [], reg)).toEqual([]);
  });

  it("skips nodes with unknown types", () => {
    const doc = docWith([N(1, "Mystery"), N(2, "Print")], [E("e1", 1, 2, "anything", "in")]);
    expect(checkUnconnectedInputs(doc.graph, [], reg)).toEqual([]);
  });
});
