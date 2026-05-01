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

const counterType: NodeTypeDescription = {
  type: "Counter",
  display_name: "Counter",
  category: "Plugin",
  inputs: [{ name: "tick", type: "int" }],
  outputs: [{ name: "count", type: "int" }],
  parameters: { start: { type: "int", required: false, default: 0 } },
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
    expect(defaultRegistry().all().length).toBeGreaterThanOrEqual(3);
  });

  it("createRegistry accepts an explicit list", () => {
    const r = createRegistry([fakeType]);
    expect(r.get("Fake")?.type).toBe("Fake");
    expect(r.all()).toHaveLength(1);
  });

  it("has() reports membership", () => {
    const r = createRegistry([fakeType]);
    expect(r.has("Fake")).toBe(true);
    expect(r.has("NotPresent")).toBe(false);
  });
});

describe("registry.register", () => {
  it("adds a new node type that becomes visible to get / has / all", () => {
    const r = createRegistry([fakeType]);
    expect(r.has("Counter")).toBe(false);
    r.register(counterType);
    expect(r.has("Counter")).toBe(true);
    expect(r.get("Counter")?.display_name).toBe("Counter");
    expect(r.all()).toHaveLength(2);
  });

  it("rejects re-registering an existing type by default", () => {
    const r = createRegistry([fakeType]);
    expect(() => r.register(fakeType)).toThrow(/already registered/);
  });

  it("replaces an existing type when { replace: true }", () => {
    const r = createRegistry([fakeType]);
    const renamed: NodeTypeDescription = { ...fakeType, display_name: "Replaced" };
    r.register(renamed, { replace: true });
    expect(r.get("Fake")?.display_name).toBe("Replaced");
    expect(r.all()).toHaveLength(1);
  });

  it("validates input against NodeTypeDescriptionSchema and throws on bad shape", () => {
    const r = createRegistry([]);
    const bad = { type: "Bad" } as unknown as NodeTypeDescription;
    expect(() => r.register(bad)).toThrow();
    expect(r.has("Bad")).toBe(false);
  });
});

describe("registry.unregister", () => {
  it("removes a registered type and returns true", () => {
    const r = createRegistry([fakeType, counterType]);
    expect(r.unregister("Fake")).toBe(true);
    expect(r.has("Fake")).toBe(false);
    expect(r.has("Counter")).toBe(true);
  });

  it("returns false for an unknown type and is a no-op", () => {
    const r = createRegistry([fakeType]);
    expect(r.unregister("Ghost")).toBe(false);
    expect(r.all()).toHaveLength(1);
  });
});

describe("defaultRegistry as plugin host", () => {
  it("survives a register/unregister round-trip without losing the built-ins", () => {
    const before = defaultRegistry().all().length;
    defaultRegistry().register(counterType);
    expect(defaultRegistry().has("Counter")).toBe(true);
    expect(defaultRegistry().has("Constant")).toBe(true);
    defaultRegistry().unregister("Counter");
    expect(defaultRegistry().has("Counter")).toBe(false);
    expect(defaultRegistry().all().length).toBe(before);
  });
});
