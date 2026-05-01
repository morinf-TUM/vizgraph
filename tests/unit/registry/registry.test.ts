import { describe, it, expect } from "vitest";
import { createRegistry, defaultRegistry } from "../../../src/registry/registry";
import type { NodeTypeDescription } from "../../../src/registry/types";

const fakeType: NodeTypeDescription = {
  type: "Fake",
  display_name: "Fake",
  category: "Test",
  inputs: [],
  outputs: [],
  parameters: {},
};

describe("registry", () => {
  it("default registry exposes the three built-ins", () => {
    expect(defaultRegistry().get("Constant")?.type).toBe("Constant");
    expect(defaultRegistry().get("Add")?.type).toBe("Add");
    expect(defaultRegistry().get("Print")?.type).toBe("Print");
  });

  it("returns undefined for unknown types", () => {
    expect(defaultRegistry().get("NotARealType")).toBeUndefined();
  });

  it("all() returns every registered description", () => {
    expect(defaultRegistry().all().length).toBe(3);
  });

  it("createRegistry accepts an explicit list", () => {
    const r = createRegistry([fakeType]);
    expect(r.get("Fake")?.type).toBe("Fake");
    expect(r.all()).toHaveLength(1);
  });
});
