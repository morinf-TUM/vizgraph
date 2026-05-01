import { describe, it, expect } from "vitest";
import { safeLoadLegacy as loadLegacy } from "../../../src/serializer/legacy";

const sample = {
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
};

describe("loadLegacy", () => {
  it("loads the prompt's simple-add fixture", () => {
    const r = loadLegacy(sample);
    expect(r.success).toBe(true);
    if (!r.success) return;

    const ids = r.data.graph.nodes.map((n) => n.id).sort();
    expect(ids).toEqual([1, 2, 3, 4]);

    const names = r.data.graph.nodes.map((n) => n.name);
    expect(names).toEqual(["Two", "Three", "Adder", "Output"]);

    const constant = r.data.graph.nodes.find((n) => n.id === 1)!;
    expect(constant.parameters).toEqual({ value: 2 });

    expect(r.data.graph.edges).toHaveLength(3);
    expect(r.data.graph.edges[0]!.id).toBe("e1_out__3_a");
  });

  it("assigns default positions to nodes lacking position", () => {
    const r = loadLegacy(sample);
    if (!r.success) throw new Error("expected success");
    expect(r.data.graph.nodes[0]!.position).toEqual({ x: 0, y: 0 });
    expect(r.data.graph.nodes[1]!.position).toEqual({ x: 200, y: 0 });
  });

  it("rejects a missing required Constant.value", () => {
    const bad = { nodes: [{ uid: 1, type: "Constant" }], edges: [] };
    const r = loadLegacy(bad);
    expect(r.success).toBe(false);
  });

  it("rejects nodes with non-integer uid", () => {
    const bad = { nodes: [{ uid: "x", type: "Print" }], edges: [] };
    const r = loadLegacy(bad);
    expect(r.success).toBe(false);
  });

  it("preserves Add and Print without parameters", () => {
    const r = loadLegacy(sample);
    if (!r.success) throw new Error("expected success");
    const adder = r.data.graph.nodes.find((n) => n.id === 3)!;
    expect(adder.parameters).toEqual({});
    const printer = r.data.graph.nodes.find((n) => n.id === 4)!;
    expect(printer.parameters).toEqual({});
  });
});
