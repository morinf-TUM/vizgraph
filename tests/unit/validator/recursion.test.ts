import { describe, expect, it } from "vitest";
import { validate } from "../../../src/validator/validate";
import type { GraphDocument } from "../../../src/document/types";

describe("validator recursion", () => {
  it("ISOLATED_NODE fires for a node deep inside a sub-graph and emits the path", () => {
    const doc: GraphDocument = {
      version: 1,
      graph: {
        nodes: [
          {
            id: 11,
            type: "Subgraph",
            position: { x: 0, y: 0 },
            parameters: {
              children: {
                version: 1,
                graph: {
                  nodes: [
                    {
                      id: 99,
                      type: "Constant",
                      position: { x: 0, y: 0 },
                      parameters: { value: 1 },
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
    const diags = validate(doc);
    const isolated = diags.find((d) => d.code === "isolated_node" && d.node_id === 99);
    expect(isolated).toBeDefined();
    expect(isolated?.path).toEqual([11]);
  });
});
