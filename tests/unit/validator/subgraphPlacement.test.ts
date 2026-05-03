import { describe, expect, it } from "vitest";
import type { Graph } from "../../../src/document/types";
import { checkSubgraphPlacement } from "../../../src/validator/rules/subgraphPlacement";

const g = (nodes: Graph["nodes"]): Graph => ({ nodes, edges: [], comments: [] });

describe("checkSubgraphPlacement", () => {
  it("emits pseudo_node_at_root for a SubgraphInput at root level", () => {
    const out = checkSubgraphPlacement(
      g([
        {
          id: 1,
          type: "SubgraphInput",
          position: { x: 0, y: 0 },
          parameters: { name: "x", portType: "int" },
        },
      ]),
      [],
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.code).toBe("pseudo_node_at_root");
    expect(out[0]?.node_id).toBe(1);
  });

  it("emits pseudo_node_at_root for a SubgraphOutput at root level", () => {
    const out = checkSubgraphPlacement(
      g([
        {
          id: 2,
          type: "SubgraphOutput",
          position: { x: 0, y: 0 },
          parameters: { name: "y", portType: "int" },
        },
      ]),
      [],
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.code).toBe("pseudo_node_at_root");
    expect(out[0]?.node_id).toBe(2);
  });

  it("does not emit when path is non-empty (inside a sub-graph)", () => {
    const out = checkSubgraphPlacement(
      g([
        {
          id: 1,
          type: "SubgraphInput",
          position: { x: 0, y: 0 },
          parameters: { name: "x", portType: "int" },
        },
      ]),
      [42],
    );
    expect(out).toEqual([]);
  });
});
