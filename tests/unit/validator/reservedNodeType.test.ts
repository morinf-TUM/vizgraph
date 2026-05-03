import { describe, expect, it } from "vitest";
import { createRegistry } from "../../../src/registry/registry";
import { BUILT_IN_NODE_TYPES } from "../../../src/registry/builtIns";
import { checkReservedNodeTypes } from "../../../src/validator/rules/reservedNodeType";

describe("checkReservedNodeTypes", () => {
  it("emits no diagnostics for the default registry", () => {
    const reg = createRegistry(BUILT_IN_NODE_TYPES);
    expect(checkReservedNodeTypes(reg)).toEqual([]);
  });
});
