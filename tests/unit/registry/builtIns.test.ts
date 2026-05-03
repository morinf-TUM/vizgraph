import { describe, it, expect } from "vitest";
import { BUILT_IN_NODE_TYPES } from "../../../src/registry/builtIns";
import { NodeTypeDescriptionSchema } from "../../../src/registry/types";

describe("built-in node types", () => {
  it("contains Constant, Add, Print, Subgraph, SubgraphInput, SubgraphOutput", () => {
    const types = BUILT_IN_NODE_TYPES.map((d) => d.type).sort();
    expect(types).toEqual([
      "Add",
      "Constant",
      "Print",
      "Subgraph",
      "SubgraphInput",
      "SubgraphOutput",
    ]);
  });

  it("each entry passes the NodeTypeDescription schema", () => {
    for (const desc of BUILT_IN_NODE_TYPES) {
      const r = NodeTypeDescriptionSchema.safeParse(desc);
      expect(r.success, `${desc.type}: ${r.success ? "" : r.error.message}`).toBe(true);
    }
  });

  it("Constant has no inputs and one output 'out:int' with required value parameter", () => {
    const c = BUILT_IN_NODE_TYPES.find((d) => d.type === "Constant")!;
    expect(c.inputs).toEqual([]);
    expect(c.outputs).toEqual([{ name: "out", type: "int" }]);
    expect(c.parameters).toEqual({
      value: { type: "int", required: true, default: 0 },
    });
  });

  it("Add has inputs a:int and b:int, output sum:int, no parameters", () => {
    const a = BUILT_IN_NODE_TYPES.find((d) => d.type === "Add")!;
    expect(a.inputs).toEqual([
      { name: "a", type: "int" },
      { name: "b", type: "int" },
    ]);
    expect(a.outputs).toEqual([{ name: "sum", type: "int" }]);
    expect(a.parameters).toEqual({});
  });

  it("Print has input in:int, no outputs, no parameters", () => {
    const p = BUILT_IN_NODE_TYPES.find((d) => d.type === "Print")!;
    expect(p.inputs).toEqual([{ name: "in", type: "int" }]);
    expect(p.outputs).toEqual([]);
    expect(p.parameters).toEqual({});
  });
});
