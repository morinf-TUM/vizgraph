import { describe, expect, it } from "vitest";
import { canConnect } from "../../../src/editor/canConnect";
import { defaultRegistry } from "../../../src/registry/registry";
import type { GraphDocument } from "../../../src/document/types";

describe("canConnect across sub-graph boundary", () => {
  const reg = defaultRegistry();

  const doc: GraphDocument = {
    version: 1,
    graph: {
      nodes: [
        { id: 10, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 1 } },
        {
          id: 11,
          type: "Subgraph",
          position: { x: 100, y: 0 },
          parameters: {
            children: {
              version: 1,
              graph: {
                nodes: [
                  {
                    id: 1,
                    type: "SubgraphInput",
                    position: { x: 0, y: 0 },
                    parameters: { name: "x", portType: "int" },
                  },
                ],
                edges: [],
                comments: [],
              },
            },
          },
        },
      ],
      edges: [],
      comments: [],
    },
  };

  it("accepts a Constant.out -> Subgraph.x edge when the inner SubgraphInput has matching type", () => {
    const r = canConnect(doc, reg, { node: 10, port: "out" }, { node: 11, port: "x" });
    expect(r.ok).toBe(true);
  });

  it("rejects when the inner SubgraphInput has a clashing portType", () => {
    const clashing: GraphDocument = {
      ...doc,
      graph: {
        ...doc.graph,
        nodes: doc.graph.nodes.map((n) =>
          n.id === 11
            ? {
                ...n,
                parameters: {
                  children: {
                    version: 1,
                    graph: {
                      nodes: [
                        {
                          id: 1,
                          type: "SubgraphInput",
                          position: { x: 0, y: 0 },
                          parameters: { name: "x", portType: "string" },
                        },
                      ],
                      edges: [],
                      comments: [],
                    },
                  },
                },
              }
            : n,
        ),
      },
    };
    const r = canConnect(clashing, reg, { node: 10, port: "out" }, { node: 11, port: "x" });
    expect(r.ok).toBe(false);
  });
});
