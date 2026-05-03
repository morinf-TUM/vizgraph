import { describe, expect, it } from "vitest";
import type { Graph } from "../../../src/document/types";
import { checkSubgraphSchema } from "../../../src/validator/rules/subgraphSchema";

const graph = (nodes: Graph["nodes"]): Graph => ({ nodes, edges: [], comments: [] });

describe("checkSubgraphSchema", () => {
  it("emits subgraph_invalid_parameters when Subgraph parameters fail to parse", () => {
    const g = graph([
      // Missing children entirely.
      { id: 1, type: "Subgraph", position: { x: 0, y: 0 }, parameters: {} },
    ]);
    const out = checkSubgraphSchema(g);
    expect(out).toHaveLength(1);
    expect(out[0]?.code).toBe("subgraph_invalid_parameters");
    expect(out[0]?.node_id).toBe(1);
  });

  it("emits pseudo_node_invalid_parameters for malformed SubgraphInput parameters", () => {
    const g = graph([
      { id: 1, type: "SubgraphInput", position: { x: 0, y: 0 }, parameters: { name: "" } },
    ]);
    const out = checkSubgraphSchema(g);
    expect(out).toHaveLength(1);
    expect(out[0]?.code).toBe("pseudo_node_invalid_parameters");
    expect(out[0]?.node_id).toBe(1);
  });

  it("does not emit for well-formed Subgraph and pseudo-nodes", () => {
    const g = graph([
      {
        id: 1,
        type: "Subgraph",
        position: { x: 0, y: 0 },
        parameters: {
          children: { version: 1, graph: { nodes: [], edges: [], comments: [] } },
        },
      },
      {
        id: 2,
        type: "SubgraphInput",
        position: { x: 0, y: 0 },
        parameters: { name: "x", portType: "int" },
      },
    ]);
    expect(checkSubgraphSchema(g)).toEqual([]);
  });
});
