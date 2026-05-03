import { describe, it, expect } from "vitest";
import {
  checkUnknownNodeTypes,
  checkMissingRequiredParameters,
  checkParameterTypeMismatch,
} from "../../../../src/validator/rules/params";
import { GraphDocumentSchema, type GraphDocument } from "../../../../src/document/types";
import { CODES } from "../../../../src/validator/codes";
import { createRegistry, defaultRegistry } from "../../../../src/registry/registry";
import type { NodeTypeDescription } from "../../../../src/registry/types";

const docWithNodes = (nodes: unknown[]): GraphDocument =>
  GraphDocumentSchema.parse({ version: 1, graph: { nodes, edges: [] } });

const reg = defaultRegistry();

describe("checkUnknownNodeTypes", () => {
  it("returns no diagnostics when every node's type is in the registry", () => {
    const doc = docWithNodes([
      { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 0 } },
      { id: 2, type: "Print", position: { x: 0, y: 0 } },
    ]);
    expect(checkUnknownNodeTypes(doc.graph, [], reg)).toEqual([]);
  });

  it("emits UNKNOWN_NODE_TYPE per offending node", () => {
    const doc = docWithNodes([
      { id: 1, type: "Mystery", position: { x: 0, y: 0 } },
      { id: 2, type: "Print", position: { x: 0, y: 0 } },
      { id: 3, type: "Phantom", position: { x: 0, y: 0 } },
    ]);
    const diags = checkUnknownNodeTypes(doc.graph, [], reg);
    expect(diags).toHaveLength(2);
    expect(diags[0]?.code).toBe(CODES.UNKNOWN_NODE_TYPE);
    expect(diags[0]?.severity).toBe("error");
    expect(diags[0]?.node_id).toBe(1);
    expect(diags[0]?.message).toMatch(/Mystery/);
    expect(diags[1]?.node_id).toBe(3);
    expect(diags[1]?.message).toMatch(/Phantom/);
  });
});

describe("checkMissingRequiredParameters", () => {
  it("returns no diagnostics when all required parameters are present", () => {
    const doc = docWithNodes([
      { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 42 } },
    ]);
    expect(checkMissingRequiredParameters(doc.graph, [], reg)).toEqual([]);
  });

  it("emits MISSING_REQUIRED_PARAMETER when a required param is absent", () => {
    const doc = docWithNodes([
      { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: {} },
    ]);
    const diags = checkMissingRequiredParameters(doc.graph, [], reg);
    expect(diags).toHaveLength(1);
    expect(diags[0]?.code).toBe(CODES.MISSING_REQUIRED_PARAMETER);
    expect(diags[0]?.severity).toBe("error");
    expect(diags[0]?.node_id).toBe(1);
    expect(diags[0]?.field).toBe("parameters.value");
    expect(diags[0]?.message).toMatch(/value/);
  });

  it("does not flag optional missing parameters", () => {
    const Opt: NodeTypeDescription = {
      type: "Opt",
      display_name: "Opt",
      category: "X",
      inputs: [],
      outputs: [],
      parameters: { foo: { type: "string", required: false } },
    };
    const doc = docWithNodes([{ id: 1, type: "Opt", position: { x: 0, y: 0 }, parameters: {} }]);
    expect(checkMissingRequiredParameters(doc.graph, [], createRegistry([Opt]))).toEqual([]);
  });

  it("skips nodes whose type is unknown (handled by UNKNOWN_NODE_TYPE)", () => {
    const doc = docWithNodes([
      { id: 1, type: "Mystery", position: { x: 0, y: 0 }, parameters: {} },
    ]);
    expect(checkMissingRequiredParameters(doc.graph, [], reg)).toEqual([]);
  });

  it("emits one diagnostic per missing required parameter on a single node", () => {
    const Two: NodeTypeDescription = {
      type: "Two",
      display_name: "Two",
      category: "X",
      inputs: [],
      outputs: [],
      parameters: {
        a: { type: "int", required: true },
        b: { type: "string", required: true },
      },
    };
    const doc = docWithNodes([{ id: 1, type: "Two", position: { x: 0, y: 0 }, parameters: {} }]);
    const diags = checkMissingRequiredParameters(doc.graph, [], createRegistry([Two]));
    expect(diags.map((d) => d.field)).toEqual(["parameters.a", "parameters.b"]);
  });
});

describe("checkParameterTypeMismatch", () => {
  it("accepts an int parameter set to an integer", () => {
    const doc = docWithNodes([
      { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 7 } },
    ]);
    expect(checkParameterTypeMismatch(doc.graph, [], reg)).toEqual([]);
  });

  it("emits PARAMETER_TYPE_MISMATCH when an int parameter is given a string", () => {
    const doc = docWithNodes([
      { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: "seven" } },
    ]);
    const diags = checkParameterTypeMismatch(doc.graph, [], reg);
    expect(diags).toHaveLength(1);
    expect(diags[0]?.code).toBe(CODES.PARAMETER_TYPE_MISMATCH);
    expect(diags[0]?.severity).toBe("error");
    expect(diags[0]?.node_id).toBe(1);
    expect(diags[0]?.field).toBe("parameters.value");
    expect(diags[0]?.message).toMatch(/int/);
  });

  it("emits PARAMETER_TYPE_MISMATCH when an int parameter is given a non-integer number", () => {
    const doc = docWithNodes([
      { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 1.5 } },
    ]);
    expect(checkParameterTypeMismatch(doc.graph, [], reg)).toHaveLength(1);
  });

  it("accepts a string parameter set to a string", () => {
    const S: NodeTypeDescription = {
      type: "S",
      display_name: "S",
      category: "X",
      inputs: [],
      outputs: [],
      parameters: { name: { type: "string", required: true } },
    };
    const doc = docWithNodes([
      { id: 1, type: "S", position: { x: 0, y: 0 }, parameters: { name: "hello" } },
    ]);
    expect(checkParameterTypeMismatch(doc.graph, [], createRegistry([S]))).toEqual([]);
  });

  it("emits PARAMETER_TYPE_MISMATCH when a string parameter is given a number", () => {
    const S: NodeTypeDescription = {
      type: "S",
      display_name: "S",
      category: "X",
      inputs: [],
      outputs: [],
      parameters: { name: { type: "string", required: true } },
    };
    const doc = docWithNodes([
      { id: 1, type: "S", position: { x: 0, y: 0 }, parameters: { name: 5 } },
    ]);
    expect(checkParameterTypeMismatch(doc.graph, [], createRegistry([S]))).toHaveLength(1);
  });

  it("accepts unknown parameter type strings (forward-compat: skip with no diagnostic)", () => {
    const Future: NodeTypeDescription = {
      type: "Future",
      display_name: "Future",
      category: "X",
      inputs: [],
      outputs: [],
      parameters: { x: { type: "tensor3d", required: true } },
    };
    const doc = docWithNodes([
      {
        id: 1,
        type: "Future",
        position: { x: 0, y: 0 },
        parameters: { x: { whatever: true } },
      },
    ]);
    expect(checkParameterTypeMismatch(doc.graph, [], createRegistry([Future]))).toEqual([]);
  });

  it("skips nodes whose type is unknown", () => {
    const doc = docWithNodes([
      { id: 1, type: "Mystery", position: { x: 0, y: 0 }, parameters: { value: "x" } },
    ]);
    expect(checkParameterTypeMismatch(doc.graph, [], reg)).toEqual([]);
  });

  it("does not flag a parameter that is absent (handled by MISSING_REQUIRED_PARAMETER)", () => {
    const doc = docWithNodes([
      { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: {} },
    ]);
    expect(checkParameterTypeMismatch(doc.graph, [], reg)).toEqual([]);
  });
});
