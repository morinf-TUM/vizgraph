import { describe, expect, it } from "vitest";
import type { GraphDocument } from "../../../src/document/types";
import { defaultRegistry } from "../../../src/registry/registry";
import { checkSubgraphPorts } from "../../../src/validator/rules/subgraphPorts";

const reg = defaultRegistry();

const baseDoc = (subgraphChildren: GraphDocument["graph"]): GraphDocument => ({
  version: 1,
  graph: {
    nodes: [
      {
        id: 11,
        type: "Subgraph",
        position: { x: 0, y: 0 },
        parameters: {
          children: { version: 1, graph: subgraphChildren },
        },
      },
    ],
    edges: [],
    comments: [],
  },
});

describe("checkSubgraphPorts", () => {
  it("emits pseudo_node_duplicate_name when two pseudo-nodes share parameters.name", () => {
    const doc = baseDoc({
      nodes: [
        {
          id: 1,
          type: "SubgraphInput",
          position: { x: 0, y: 0 },
          parameters: { name: "x", portType: "int" },
        },
        {
          id: 2,
          type: "SubgraphInput",
          position: { x: 0, y: 50 },
          parameters: { name: "x", portType: "int" },
        },
      ],
      edges: [],
      comments: [],
    });
    const out = checkSubgraphPorts(doc, reg);
    expect(out.some((d) => d.code === "pseudo_node_duplicate_name")).toBe(true);
  });

  it("emits subgraph_port_unbound when a parent edge targets a non-existent inner port name", () => {
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
                graph: { nodes: [], edges: [], comments: [] },
              },
            },
          },
        ],
        edges: [
          {
            id: "e10_out__11_x",
            source: { node: 10, port: "out" },
            target: { node: 11, port: "x" },
          },
        ],
        comments: [],
      },
    };
    const out = checkSubgraphPorts(doc, reg);
    expect(out.some((d) => d.code === "subgraph_port_unbound")).toBe(true);
  });

  it("emits subgraph_port_type_mismatch when types disagree across the boundary", () => {
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
                      parameters: { name: "x", portType: "string" },
                    },
                  ],
                  edges: [],
                  comments: [],
                },
              },
            },
          },
        ],
        edges: [
          {
            id: "e10_out__11_x",
            source: { node: 10, port: "out" },
            target: { node: 11, port: "x" },
          },
        ],
        comments: [],
      },
    };
    const out = checkSubgraphPorts(doc, reg);
    expect(out.some((d) => d.code === "subgraph_port_type_mismatch")).toBe(true);
  });
});
