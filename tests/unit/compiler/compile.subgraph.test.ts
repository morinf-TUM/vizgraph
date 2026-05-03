import { describe, expect, it } from "vitest";
import { compile } from "../../../src/compiler/compile";
import type { GraphDocument } from "../../../src/document/types";

describe("compile() with sub-graphs", () => {
  it("flattens a one-level sub-graph: Const -> Subgraph(Add) -> Print", () => {
    const doc: GraphDocument = {
      version: 1,
      graph: {
        nodes: [
          { id: 10, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 7 } },
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
                    { id: 2, type: "Add", position: { x: 100, y: 0 }, parameters: {} },
                    {
                      id: 3,
                      type: "SubgraphOutput",
                      position: { x: 200, y: 0 },
                      parameters: { name: "y", portType: "int" },
                    },
                    {
                      id: 4,
                      type: "Constant",
                      position: { x: 0, y: 100 },
                      parameters: { value: 1 },
                    },
                  ],
                  edges: [
                    // Inner edges use registry-declared pseudo-node port handles.
                    { id: "i1", source: { node: 1, port: "out" }, target: { node: 2, port: "a" } },
                    { id: "i2", source: { node: 4, port: "out" }, target: { node: 2, port: "b" } },
                    { id: "i3", source: { node: 2, port: "sum" }, target: { node: 3, port: "in" } },
                  ],
                  comments: [],
                },
              },
            },
          },
          { id: 12, type: "Print", position: { x: 200, y: 0 }, parameters: {} },
        ],
        edges: [
          // Outer edges use the pseudo-node's parameters.name as the port id.
          { id: "o1", source: { node: 10, port: "out" }, target: { node: 11, port: "x" } },
          { id: "o2", source: { node: 11, port: "y" }, target: { node: 12, port: "in" } },
        ],
        comments: [],
      },
    };
    const { graph, idMap } = compile(doc);
    // Real nodes only: Const(10), Add(2), Const(4), Print(12). 4 nodes.
    expect(graph.nodes.map((n) => n.type).sort()).toEqual(["Add", "Constant", "Constant", "Print"]);
    expect(graph.nodes).toHaveLength(4);

    const findUid = (path: string): number => {
      const v = idMap.get(path);
      if (v === undefined) throw new Error(`missing ${path}`);
      return v;
    };
    const constOuter = findUid("10");
    const addInner = findUid("11/2");
    const constInner = findUid("11/4");
    const print = findUid("12");

    // Edges resolved: 10 -> Add.a, 4 -> Add.b, Add.sum -> Print.in.
    expect(graph.edges).toHaveLength(3);
    const edgePairs = graph.edges
      .map((e) => `${String(e.src)} ${e.port_out} -> ${String(e.dst)} ${e.port_in}`)
      .sort();
    expect(edgePairs).toEqual(
      [
        `${String(constOuter)} out -> ${String(addInner)} a`,
        `${String(constInner)} out -> ${String(addInner)} b`,
        `${String(addInner)} sum -> ${String(print)} in`,
      ].sort(),
    );
  });

  it("is deterministic: same input produces byte-identical output", () => {
    const buildDoc = (): GraphDocument => ({
      version: 1,
      graph: {
        nodes: [
          { id: 10, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 5 } },
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
                    { id: 2, type: "Print", position: { x: 100, y: 0 }, parameters: {} },
                  ],
                  edges: [
                    { id: "i1", source: { node: 1, port: "out" }, target: { node: 2, port: "in" } },
                  ],
                  comments: [],
                },
              },
            },
          },
        ],
        edges: [{ id: "o1", source: { node: 10, port: "out" }, target: { node: 11, port: "x" } }],
        comments: [],
      },
    });
    const a = compile(buildDoc()).graph;
    const b = compile(buildDoc()).graph;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
