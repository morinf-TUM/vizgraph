import { describe, it, expect } from "vitest";
import { canConnect } from "../../../src/editor/canConnect";
import { GraphDocumentSchema, type GraphDocument } from "../../../src/document/types";
import { defaultRegistry, createRegistry } from "../../../src/registry/registry";
import type { NodeTypeDescription } from "../../../src/registry/types";

const docOf = (input: unknown): GraphDocument => GraphDocumentSchema.parse(input);

const reg = defaultRegistry();

const baseDoc = docOf({
  version: 1,
  graph: {
    nodes: [
      { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 1 } },
      { id: 2, type: "Add", position: { x: 0, y: 0 } },
      { id: 3, type: "Print", position: { x: 0, y: 0 } },
    ],
    edges: [],
  },
});

describe("canConnect", () => {
  it("allows a valid Constant.out -> Add.a", () => {
    expect(canConnect(baseDoc, reg, { node: 1, port: "out" }, { node: 2, port: "a" })).toEqual({
      ok: true,
    });
  });

  it("rejects a self-loop", () => {
    const r = canConnect(baseDoc, reg, { node: 2, port: "sum" }, { node: 2, port: "a" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/self-loop/);
  });

  it("rejects a missing source node", () => {
    const r = canConnect(baseDoc, reg, { node: 99, port: "out" }, { node: 2, port: "a" });
    expect(r.ok).toBe(false);
  });

  it("rejects an unknown output port name", () => {
    const r = canConnect(baseDoc, reg, { node: 1, port: "ghost" }, { node: 2, port: "a" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/output port/);
  });

  it("rejects an unknown input port name", () => {
    const r = canConnect(baseDoc, reg, { node: 1, port: "out" }, { node: 2, port: "c" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/input port/);
  });

  it("rejects a port-type mismatch when both declare types", () => {
    const A: NodeTypeDescription = {
      type: "A",
      display_name: "A",
      category: "X",
      inputs: [],
      outputs: [{ name: "out", type: "int" }],
      parameters: {},
    };
    const B: NodeTypeDescription = {
      type: "B",
      display_name: "B",
      category: "X",
      inputs: [{ name: "in", type: "string" }],
      outputs: [],
      parameters: {},
    };
    const customReg = createRegistry([A, B]);
    const doc = docOf({
      version: 1,
      graph: {
        nodes: [
          { id: 1, type: "A", position: { x: 0, y: 0 } },
          { id: 2, type: "B", position: { x: 0, y: 0 } },
        ],
        edges: [],
      },
    });
    const r = canConnect(doc, customReg, { node: 1, port: "out" }, { node: 2, port: "in" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/type mismatch/);
  });
});
