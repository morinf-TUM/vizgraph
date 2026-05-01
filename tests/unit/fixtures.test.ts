import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadLegacy } from "../../src/serializer/legacy";
import { loadVersioned } from "../../src/serializer/versioned";
import { validate } from "../../src/validator/validate";
import { compile } from "../../src/compiler/compile";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "..", "..", "fixtures");

const readJson = (relative: string): unknown =>
  JSON.parse(readFileSync(join(fixturesDir, relative), "utf8")) as unknown;

const legacySimpleAdd = readJson("legacy/simple-add.json");
const legacyParallelAdd = readJson("legacy/parallel-add.json");
const versionedSimpleAdd = readJson("versioned/simple-add.json");

describe("fixtures: legacy -> versioned round-trip", () => {
  it("simple-add: legacy loader produces the on-disk versioned fixture exactly", () => {
    const result = loadLegacy(legacySimpleAdd);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(versionedSimpleAdd);
  });

  it("simple-add: round-trip preserves IDs, names, parameters, edge endpoints, positions", () => {
    const loaded = loadLegacy(legacySimpleAdd);
    expect(loaded.success).toBe(true);
    if (!loaded.success) return;
    const doc = loaded.data;
    expect(doc.graph.nodes.map((n) => n.id)).toEqual([1, 2, 3, 4]);
    expect(doc.graph.nodes.map((n) => n.name)).toEqual(["Two", "Three", "Adder", "Output"]);
    expect(doc.graph.nodes[0]?.parameters).toEqual({ value: 2 });
    expect(doc.graph.nodes[1]?.parameters).toEqual({ value: 3 });
    expect(
      doc.graph.edges.map(
        (e) =>
          `${String(e.source.node)}.${e.source.port}->${String(e.target.node)}.${e.target.port}`,
      ),
    ).toEqual(["1.out->3.a", "2.out->3.b", "3.sum->4.in"]);
    expect(doc.graph.nodes.map((n) => n.position.x)).toEqual([0, 200, 400, 600]);
  });

  it("parallel-add: loads cleanly into a versioned document with 8 nodes and 7 edges", () => {
    const loaded = loadLegacy(legacyParallelAdd);
    expect(loaded.success).toBe(true);
    if (!loaded.success) return;
    expect(loaded.data.graph.nodes).toHaveLength(8);
    expect(loaded.data.graph.edges).toHaveLength(7);
  });
});

describe("fixtures: validator", () => {
  it("simple-add (versioned) passes validate() with zero diagnostics", () => {
    const loaded = loadVersioned(versionedSimpleAdd);
    expect(loaded.success).toBe(true);
    if (loaded.success) expect(validate(loaded.data)).toEqual([]);
  });

  it("parallel-add (loaded from legacy) passes validate() with zero diagnostics", () => {
    const loaded = loadLegacy(legacyParallelAdd);
    expect(loaded.success).toBe(true);
    if (loaded.success) expect(validate(loaded.data)).toEqual([]);
  });
});

describe("fixtures: compiler", () => {
  it("compiles simple-add back to its legacy shape (modulo the on-disk JSON literal)", () => {
    const loaded = loadVersioned(versionedSimpleAdd);
    expect(loaded.success).toBe(true);
    if (!loaded.success) return;
    expect(compile(loaded.data)).toEqual(legacySimpleAdd);
  });

  it("compiles parallel-add to a graph with 8 nodes and 7 edges", () => {
    const loaded = loadLegacy(legacyParallelAdd);
    expect(loaded.success).toBe(true);
    if (!loaded.success) return;
    const compiled = compile(loaded.data);
    expect(compiled.nodes).toHaveLength(8);
    expect(compiled.edges).toHaveLength(7);
    const printNode = compiled.nodes.find((n) => n.type === "Print");
    expect(printNode).toEqual({ uid: 8, type: "Print" });
  });
});
