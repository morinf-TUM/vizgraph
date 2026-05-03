import { describe, expect, it } from "vitest";
import { defaultRegistry } from "../../../src/registry/registry";

describe("subgraph built-in node types", () => {
  const reg = defaultRegistry();

  it("registers Subgraph as a category=Subgraph type", () => {
    const desc = reg.get("Subgraph");
    expect(desc).toBeDefined();
    expect(desc?.category).toBe("Subgraph");
    expect(desc?.inputs).toEqual([]);
    expect(desc?.outputs).toEqual([]);
  });

  it("registers SubgraphInput with one untyped output handle (typed at runtime by parameters.portType)", () => {
    const desc = reg.get("SubgraphInput");
    expect(desc).toBeDefined();
    expect(desc?.inputs).toEqual([]);
    expect(desc?.outputs).toEqual([{ name: "out" }]);
  });

  it("registers SubgraphOutput with one untyped input handle", () => {
    const desc = reg.get("SubgraphOutput");
    expect(desc).toBeDefined();
    expect(desc?.inputs).toEqual([{ name: "in" }]);
    expect(desc?.outputs).toEqual([]);
  });
});
