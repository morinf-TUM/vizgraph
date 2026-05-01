import { describe, it, expect } from "vitest";
import {
  checkInvalidSourcePort,
  checkInvalidTargetPort,
  checkPortTypeMismatch,
} from "../../../../src/validator/rules/ports";
import { GraphDocumentSchema, type GraphDocument } from "../../../../src/document/types";
import { CODES } from "../../../../src/validator/codes";
import { createRegistry, defaultRegistry } from "../../../../src/registry/registry";
import type { NodeTypeDescription } from "../../../../src/registry/types";

const docWith = (nodes: unknown[], edges: unknown[]): GraphDocument =>
  GraphDocumentSchema.parse({ version: 1, graph: { nodes, edges } });

const node = (id: number, type: string) => ({
  id,
  type,
  position: { x: 0, y: 0 },
  parameters: type === "Constant" ? { value: 0 } : {},
});

const reg = defaultRegistry();

describe("checkInvalidSourcePort", () => {
  it("returns no diagnostics when every edge's source port exists on its source node type", () => {
    const doc = docWith(
      [node(1, "Constant"), node(2, "Print")],
      [{ id: "e1", source: { node: 1, port: "out" }, target: { node: 2, port: "in" } }],
    );
    expect(checkInvalidSourcePort(doc, reg)).toEqual([]);
  });

  it("emits INVALID_SOURCE_PORT when the source port name is not in the type's outputs", () => {
    const doc = docWith(
      [node(1, "Constant"), node(2, "Print")],
      [{ id: "e1", source: { node: 1, port: "wrong" }, target: { node: 2, port: "in" } }],
    );
    const diags = checkInvalidSourcePort(doc, reg);
    expect(diags).toHaveLength(1);
    expect(diags[0]?.code).toBe(CODES.INVALID_SOURCE_PORT);
    expect(diags[0]?.severity).toBe("error");
    expect(diags[0]?.edge_id).toBe("e1");
    expect(diags[0]?.node_id).toBe(1);
    expect(diags[0]?.field).toBe("source.port");
    expect(diags[0]?.message).toMatch(/wrong/);
  });

  it("skips edges whose source node is missing (handled by edges rule)", () => {
    const doc = docWith(
      [node(2, "Print")],
      [{ id: "e1", source: { node: 99, port: "out" }, target: { node: 2, port: "in" } }],
    );
    expect(checkInvalidSourcePort(doc, reg)).toEqual([]);
  });

  it("skips edges whose source node type is unknown (handled by unknown-type rule)", () => {
    const doc = docWith(
      [node(1, "Mystery"), node(2, "Print")],
      [{ id: "e1", source: { node: 1, port: "anything" }, target: { node: 2, port: "in" } }],
    );
    expect(checkInvalidSourcePort(doc, reg)).toEqual([]);
  });

  it("emits one diagnostic per offending edge", () => {
    const doc = docWith(
      [node(1, "Constant"), node(2, "Print")],
      [
        { id: "e1", source: { node: 1, port: "bad1" }, target: { node: 2, port: "in" } },
        { id: "e2", source: { node: 1, port: "bad2" }, target: { node: 2, port: "in" } },
      ],
    );
    const diags = checkInvalidSourcePort(doc, reg);
    expect(diags.map((d) => d.edge_id)).toEqual(["e1", "e2"]);
  });
});

describe("checkInvalidTargetPort", () => {
  it("returns no diagnostics when every edge's target port exists on its target node type", () => {
    const doc = docWith(
      [node(1, "Constant"), node(2, "Print")],
      [{ id: "e1", source: { node: 1, port: "out" }, target: { node: 2, port: "in" } }],
    );
    expect(checkInvalidTargetPort(doc, reg)).toEqual([]);
  });

  it("emits INVALID_TARGET_PORT when the target port name is not in the type's inputs", () => {
    const doc = docWith(
      [node(1, "Constant"), node(2, "Add")],
      [{ id: "e2", source: { node: 1, port: "out" }, target: { node: 2, port: "c" } }],
    );
    const diags = checkInvalidTargetPort(doc, reg);
    expect(diags).toHaveLength(1);
    expect(diags[0]?.code).toBe(CODES.INVALID_TARGET_PORT);
    expect(diags[0]?.edge_id).toBe("e2");
    expect(diags[0]?.node_id).toBe(2);
    expect(diags[0]?.field).toBe("target.port");
    expect(diags[0]?.message).toMatch(/c/);
  });

  it("skips edges whose target node is missing", () => {
    const doc = docWith(
      [node(1, "Constant")],
      [{ id: "e1", source: { node: 1, port: "out" }, target: { node: 99, port: "in" } }],
    );
    expect(checkInvalidTargetPort(doc, reg)).toEqual([]);
  });

  it("skips edges whose target node type is unknown", () => {
    const doc = docWith(
      [node(1, "Constant"), node(2, "Mystery")],
      [{ id: "e1", source: { node: 1, port: "out" }, target: { node: 2, port: "anything" } }],
    );
    expect(checkInvalidTargetPort(doc, reg)).toEqual([]);
  });
});

describe("checkPortTypeMismatch", () => {
  const A: NodeTypeDescription = {
    type: "A",
    display_name: "A",
    category: "X",
    inputs: [],
    outputs: [{ name: "outInt", type: "int" }],
    parameters: {},
  };
  const B: NodeTypeDescription = {
    type: "B",
    display_name: "B",
    category: "X",
    inputs: [{ name: "inStr", type: "string" }],
    outputs: [],
    parameters: {},
  };
  const C: NodeTypeDescription = {
    type: "C",
    display_name: "C",
    category: "X",
    inputs: [{ name: "inUntyped" }],
    outputs: [{ name: "outUntyped" }],
    parameters: {},
  };
  const customReg = createRegistry([A, B, C]);

  it("returns no diagnostics when port types match", () => {
    const doc = docWith(
      [node(1, "Constant"), node(2, "Add")],
      [{ id: "e1", source: { node: 1, port: "out" }, target: { node: 2, port: "a" } }],
    );
    expect(checkPortTypeMismatch(doc, reg)).toEqual([]);
  });

  it("emits PORT_TYPE_MISMATCH when both ports declare types and they differ", () => {
    const doc = docWith(
      [node(1, "A"), node(2, "B")],
      [{ id: "e1", source: { node: 1, port: "outInt" }, target: { node: 2, port: "inStr" } }],
    );
    const diags = checkPortTypeMismatch(doc, customReg);
    expect(diags).toHaveLength(1);
    expect(diags[0]?.code).toBe(CODES.PORT_TYPE_MISMATCH);
    expect(diags[0]?.severity).toBe("error");
    expect(diags[0]?.edge_id).toBe("e1");
    expect(diags[0]?.message).toMatch(/int/);
    expect(diags[0]?.message).toMatch(/string/);
  });

  it("skips when source port has no declared type", () => {
    const doc = docWith(
      [node(1, "C"), node(2, "B")],
      [{ id: "e1", source: { node: 1, port: "outUntyped" }, target: { node: 2, port: "inStr" } }],
    );
    expect(checkPortTypeMismatch(doc, customReg)).toEqual([]);
  });

  it("skips when target port has no declared type", () => {
    const doc = docWith(
      [node(1, "A"), node(2, "C")],
      [{ id: "e1", source: { node: 1, port: "outInt" }, target: { node: 2, port: "inUntyped" } }],
    );
    expect(checkPortTypeMismatch(doc, customReg)).toEqual([]);
  });

  it("skips when source node is missing", () => {
    const doc = docWith(
      [node(2, "B")],
      [{ id: "e1", source: { node: 99, port: "outInt" }, target: { node: 2, port: "inStr" } }],
    );
    expect(checkPortTypeMismatch(doc, customReg)).toEqual([]);
  });

  it("skips when source port name is invalid (handled by INVALID_SOURCE_PORT)", () => {
    const doc = docWith(
      [node(1, "A"), node(2, "B")],
      [{ id: "e1", source: { node: 1, port: "ghost" }, target: { node: 2, port: "inStr" } }],
    );
    expect(checkPortTypeMismatch(doc, customReg)).toEqual([]);
  });

  it("skips when source node type is unknown", () => {
    const doc = docWith(
      [node(1, "Mystery"), node(2, "B")],
      [{ id: "e1", source: { node: 1, port: "outInt" }, target: { node: 2, port: "inStr" } }],
    );
    expect(checkPortTypeMismatch(doc, customReg)).toEqual([]);
  });
});
