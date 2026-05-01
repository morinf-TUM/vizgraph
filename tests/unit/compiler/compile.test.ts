import { describe, it, expect } from "vitest";
import { compile } from "../../../src/compiler/compile";
import { GraphDocumentSchema, type GraphDocument } from "../../../src/document/types";

const docOf = (input: unknown): GraphDocument => GraphDocumentSchema.parse(input);

describe("compile", () => {
  it("emits the legacy-shaped runtime JSON for a simple-add graph", () => {
    const doc = docOf({
      version: 1,
      graph: {
        nodes: [
          {
            id: 1,
            name: "Two",
            type: "Constant",
            position: { x: 0, y: 0 },
            parameters: { value: 2 },
          },
          {
            id: 2,
            name: "Three",
            type: "Constant",
            position: { x: 200, y: 0 },
            parameters: { value: 3 },
          },
          { id: 3, name: "Adder", type: "Add", position: { x: 400, y: 0 } },
          { id: 4, name: "Output", type: "Print", position: { x: 600, y: 0 } },
        ],
        edges: [
          {
            id: "e1_out__3_a",
            source: { node: 1, port: "out" },
            target: { node: 3, port: "a" },
          },
          {
            id: "e2_out__3_b",
            source: { node: 2, port: "out" },
            target: { node: 3, port: "b" },
          },
          {
            id: "e3_sum__4_in",
            source: { node: 3, port: "sum" },
            target: { node: 4, port: "in" },
          },
        ],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    });

    expect(compile(doc)).toEqual({
      nodes: [
        { uid: 1, name: "Two", type: "Constant", value: 2 },
        { uid: 2, name: "Three", type: "Constant", value: 3 },
        { uid: 3, name: "Adder", type: "Add" },
        { uid: 4, name: "Output", type: "Print" },
      ],
      edges: [
        { src: 1, dst: 3, port_out: "out", port_in: "a" },
        { src: 2, dst: 3, port_out: "out", port_in: "b" },
        { src: 3, dst: 4, port_out: "sum", port_in: "in" },
      ],
    });
  });

  it("omits name when not set", () => {
    const doc = docOf({
      version: 1,
      graph: {
        nodes: [{ id: 1, type: "Print", position: { x: 0, y: 0 } }],
        edges: [],
      },
    });
    const out = compile(doc);
    expect(out.nodes[0]).not.toHaveProperty("name");
  });

  it("only includes value for Constant nodes", () => {
    const doc = docOf({
      version: 1,
      graph: {
        nodes: [
          {
            id: 1,
            type: "Constant",
            position: { x: 0, y: 0 },
            parameters: { value: 7 },
          },
          { id: 2, type: "Add", position: { x: 0, y: 0 } },
          { id: 3, type: "Print", position: { x: 0, y: 0 } },
        ],
        edges: [],
      },
    });
    const out = compile(doc);
    expect(out.nodes[0]).toEqual({ uid: 1, type: "Constant", value: 7 });
    expect(out.nodes[1]).toEqual({ uid: 2, type: "Add" });
    expect(out.nodes[2]).toEqual({ uid: 3, type: "Print" });
  });

  it("strips position, viewport, and edge.id from runtime output", () => {
    const doc = docOf({
      version: 1,
      graph: {
        nodes: [
          {
            id: 1,
            type: "Constant",
            position: { x: 999, y: -999 },
            parameters: { value: 0 },
          },
          { id: 2, type: "Print", position: { x: 0, y: 0 } },
        ],
        edges: [
          {
            id: "anything-goes-here",
            source: { node: 1, port: "out" },
            target: { node: 2, port: "in" },
          },
        ],
        viewport: { x: 1234, y: 5678, zoom: 2 },
      },
    });
    const out = compile(doc);
    expect(JSON.stringify(out)).not.toMatch(/position|viewport|anything-goes-here/);
  });

  it("preserves node and edge ordering from the document", () => {
    const doc = docOf({
      version: 1,
      graph: {
        nodes: [
          { id: 5, type: "Print", position: { x: 0, y: 0 } },
          {
            id: 2,
            type: "Constant",
            position: { x: 0, y: 0 },
            parameters: { value: 1 },
          },
        ],
        edges: [
          {
            id: "eA",
            source: { node: 2, port: "out" },
            target: { node: 5, port: "in" },
          },
        ],
      },
    });
    const out = compile(doc);
    expect(out.nodes.map((n) => n.uid)).toEqual([5, 2]);
  });

  it("includes frequency_hz when set as a positive number", () => {
    const doc = docOf({
      version: 1,
      graph: {
        nodes: [{ id: 1, type: "Print", position: { x: 0, y: 0 }, frequency_hz: 60 }],
        edges: [],
      },
    });
    expect(compile(doc).nodes[0]).toEqual({ uid: 1, type: "Print", frequency_hz: 60 });
  });

  it("omits frequency_hz when null or undefined", () => {
    const doc = docOf({
      version: 1,
      graph: {
        nodes: [
          { id: 1, type: "Print", position: { x: 0, y: 0 }, frequency_hz: null },
          { id: 2, type: "Print", position: { x: 0, y: 0 } },
        ],
        edges: [],
      },
    });
    const out = compile(doc);
    expect(out.nodes[0]).not.toHaveProperty("frequency_hz");
    expect(out.nodes[1]).not.toHaveProperty("frequency_hz");
  });

  it("throws when a Constant node is missing parameters.value", () => {
    const doc = docOf({
      version: 1,
      graph: {
        nodes: [{ id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: {} }],
        edges: [],
      },
    });
    expect(() => compile(doc)).toThrow(/value/);
  });

  it("throws when a Constant value is not an integer", () => {
    const doc = docOf({
      version: 1,
      graph: {
        nodes: [
          {
            id: 1,
            type: "Constant",
            position: { x: 0, y: 0 },
            parameters: { value: 1.5 },
          },
        ],
        edges: [],
      },
    });
    expect(() => compile(doc)).toThrow(/integer|int/);
  });
});
