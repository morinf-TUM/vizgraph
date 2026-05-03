import { describe, expect, it } from "vitest";
import {
  PseudoPortParametersSchema,
  SubgraphParametersSchema,
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
} from "../../../src/document/subgraph";

describe("PseudoPortParametersSchema", () => {
  it("accepts well-formed pseudo-port parameters", () => {
    expect(PseudoPortParametersSchema.safeParse({ name: "x", portType: "int" }).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(PseudoPortParametersSchema.safeParse({ name: "", portType: "int" }).success).toBe(false);
  });

  it("rejects empty portType", () => {
    expect(PseudoPortParametersSchema.safeParse({ name: "x", portType: "" }).success).toBe(false);
  });
});

describe("SubgraphParametersSchema", () => {
  it("accepts an empty children GraphDocument", () => {
    expect(
      SubgraphParametersSchema.safeParse({
        children: { version: 1, graph: { nodes: [], edges: [], comments: [] } },
      }).success,
    ).toBe(true);
  });

  it("recursively accepts nested sub-graphs", () => {
    const inner = { version: 1, graph: { nodes: [], edges: [], comments: [] } };
    const outer = {
      children: {
        version: 1,
        graph: {
          nodes: [
            {
              id: 1,
              type: "Subgraph",
              position: { x: 0, y: 0 },
              parameters: { children: inner },
            },
          ],
          edges: [],
          comments: [],
        },
      },
    };
    // Schema parse only checks parameters.children is a GraphDocument; the
    // `parameters` field on the inner node is unknown to base NodeSchema and
    // tightened by the validator, not by Zod here. So this asserts the outer
    // shape parses cleanly.
    expect(SubgraphParametersSchema.safeParse(outer).success).toBe(true);
  });

  it("rejects a children value that is not a GraphDocument", () => {
    expect(SubgraphParametersSchema.safeParse({ children: 42 }).success).toBe(false);
  });
});

describe("reserved node-type constants", () => {
  it("are stable strings", () => {
    expect(SUBGRAPH_NODE_TYPE).toBe("Subgraph");
    expect(SUBGRAPH_INPUT_NODE_TYPE).toBe("SubgraphInput");
    expect(SUBGRAPH_OUTPUT_NODE_TYPE).toBe("SubgraphOutput");
  });
});
