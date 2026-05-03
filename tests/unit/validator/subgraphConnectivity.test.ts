import { describe, expect, it } from "vitest";
import type { Graph } from "../../../src/document/types";
import { checkSubgraphConnectivity } from "../../../src/validator/rules/subgraphConnectivity";

const g = (nodes: Graph["nodes"], edges: Graph["edges"] = []): Graph => ({
  nodes,
  edges,
  comments: [],
});

describe("checkSubgraphConnectivity", () => {
  it("warns on a SubgraphInput with no internal consumer", () => {
    const out = checkSubgraphConnectivity(
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
    expect(out.some((d) => d.code === "subgraph_input_unconnected")).toBe(true);
  });

  it("warns on a SubgraphOutput with no internal source", () => {
    const out = checkSubgraphConnectivity(
      g([
        {
          id: 1,
          type: "SubgraphOutput",
          position: { x: 0, y: 0 },
          parameters: { name: "y", portType: "int" },
        },
      ]),
      [42],
    );
    expect(out.some((d) => d.code === "subgraph_output_unconnected")).toBe(true);
  });

  it("warns on an empty Subgraph (children.nodes is empty)", () => {
    const out = checkSubgraphConnectivity(
      g([
        {
          id: 11,
          type: "Subgraph",
          position: { x: 0, y: 0 },
          parameters: {
            children: { version: 1, graph: { nodes: [], edges: [], comments: [] } },
          },
        },
      ]),
      [],
    );
    expect(out.some((d) => d.code === "empty_subgraph")).toBe(true);
  });
});
