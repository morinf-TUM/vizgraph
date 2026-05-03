import { describe, expect, it } from "vitest";
import type { GraphDocument } from "../../../src/document/types";
import { resolveSource, resolveTarget } from "../../../src/document/subgraphChase";

// Helper: build a doc with a single sub-graph that wraps Add behind ports x,y.
const docWithSubgraph = (): GraphDocument => ({
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
                { id: 2, type: "Add", position: { x: 100, y: 0 }, parameters: {} },
                {
                  id: 3,
                  type: "SubgraphOutput",
                  position: { x: 200, y: 0 },
                  parameters: { name: "y", portType: "int" },
                },
              ],
              edges: [
                { id: "e1_x__2_a", source: { node: 1, port: "x" }, target: { node: 2, port: "a" } },
                {
                  id: "e2_sum__3_y",
                  source: { node: 2, port: "sum" },
                  target: { node: 3, port: "y" },
                },
              ],
              comments: [],
            },
          },
        },
      },
      { id: 12, type: "Print", position: { x: 200, y: 0 }, parameters: {} },
    ],
    edges: [
      { id: "e10_out__11_x", source: { node: 10, port: "out" }, target: { node: 11, port: "x" } },
      { id: "e11_y__12_in", source: { node: 11, port: "y" }, target: { node: 12, port: "in" } },
    ],
    comments: [],
  },
});

describe("resolveSource", () => {
  it("returns regular node endpoints unchanged", () => {
    const doc = docWithSubgraph();
    expect(resolveSource(doc, [], { node: 10, port: "out" })).toEqual({
      node: 10,
      port: "out",
      path: [],
    });
  });

  it("descends through Subgraph container to the SubgraphOutput's feeder", () => {
    const doc = docWithSubgraph();
    expect(resolveSource(doc, [], { node: 11, port: "y" })).toEqual({
      node: 2,
      port: "sum",
      path: [11],
    });
  });

  it("ascends from SubgraphInput pseudo-node to the parent's feeder", () => {
    const doc = docWithSubgraph();
    expect(resolveSource(doc, [11], { node: 1, port: "x" })).toEqual({
      node: 10,
      port: "out",
      path: [],
    });
  });
});

describe("resolveTarget", () => {
  it("returns regular node endpoints as a singleton", () => {
    const doc = docWithSubgraph();
    expect(resolveTarget(doc, [], { node: 12, port: "in" })).toEqual([
      { node: 12, port: "in", path: [] },
    ]);
  });

  it("descends through Subgraph container, fanning out to all internal consumers", () => {
    const doc = docWithSubgraph();
    expect(resolveTarget(doc, [], { node: 11, port: "x" })).toEqual([
      { node: 2, port: "a", path: [11] },
    ]);
  });

  it("ascends from SubgraphOutput pseudo-node to all parent consumers", () => {
    const doc = docWithSubgraph();
    expect(resolveTarget(doc, [11], { node: 3, port: "y" })).toEqual([
      { node: 12, port: "in", path: [] },
    ]);
  });
});

// Regression for the chase port-filter bug: inner edges use the registry's
// pseudo-node port handles ("in" / "out"), outer edges use parameters.name.
// The chase must walk by node identity, not by matching outer port string
// against inner port string.
const docWithCanonicalPortIds = (): GraphDocument => ({
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
                { id: 2, type: "Add", position: { x: 100, y: 0 }, parameters: {} },
                {
                  id: 3,
                  type: "SubgraphOutput",
                  position: { x: 200, y: 0 },
                  parameters: { name: "y", portType: "int" },
                },
              ],
              edges: [
                // Inner edges use "out"/"in" — registry-declared pseudo-node handles.
                { id: "i1", source: { node: 1, port: "out" }, target: { node: 2, port: "a" } },
                { id: "i2", source: { node: 2, port: "sum" }, target: { node: 3, port: "in" } },
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
});

describe("resolveSource with canonical port ids", () => {
  it("descends through Subgraph and matches by node identity, not port string", () => {
    const doc = docWithCanonicalPortIds();
    expect(resolveSource(doc, [], { node: 11, port: "y" })).toEqual({
      node: 2,
      port: "sum",
      path: [11],
    });
  });
});

describe("resolveTarget with canonical port ids", () => {
  it("descends through Subgraph and matches by node identity, not port string", () => {
    const doc = docWithCanonicalPortIds();
    expect(resolveTarget(doc, [], { node: 11, port: "x" })).toEqual([
      { node: 2, port: "a", path: [11] },
    ]);
  });
});
