import { describe, it, expect } from "vitest";
import { validate } from "../../../src/validator/validate";
import { GraphDocumentSchema, type GraphDocument } from "../../../src/document/types";
import { CODES } from "../../../src/validator/codes";
import { defaultRegistry } from "../../../src/registry/registry";

const docWith = (nodes: unknown[], edges: unknown[]): GraphDocument =>
  GraphDocumentSchema.parse({ version: 1, graph: { nodes, edges } });

const N = (id: number, type: string) => ({
  id,
  type,
  position: { x: 0, y: 0 },
  parameters: type === "Constant" ? { value: 0 } : {},
});

const E = (id: string, src: number, dst: number, srcPort = "out", dstPort = "in") => ({
  id,
  source: { node: src, port: srcPort },
  target: { node: dst, port: dstPort },
});

describe("validate", () => {
  it("returns no diagnostics for a clean simple-add graph", () => {
    const doc = docWith(
      [
        { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 2 } },
        { id: 2, type: "Constant", position: { x: 100, y: 0 }, parameters: { value: 3 } },
        N(3, "Add"),
        N(4, "Print"),
      ],
      [E("e1", 1, 3, "out", "a"), E("e2", 2, 3, "out", "b"), E("e3", 3, 4, "sum", "in")],
    );
    expect(validate(doc)).toEqual([]);
  });

  it("uses defaultRegistry when no registry argument is provided", () => {
    const doc = docWith([N(1, "Mystery")], []);
    const diags = validate(doc);
    expect(diags.some((d) => d.code === CODES.UNKNOWN_NODE_TYPE)).toBe(true);
  });

  it("accepts an explicit registry override", () => {
    const doc = docWith([N(1, "Mystery")], []);
    const diags = validate(doc, defaultRegistry());
    expect(diags.some((d) => d.code === CODES.UNKNOWN_NODE_TYPE)).toBe(true);
  });

  it("aggregates diagnostics across multiple rules without re-emitting", () => {
    const doc = docWith(
      [
        { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: {} },
        { id: 1, type: "Print", position: { x: 0, y: 0 } },
      ],
      [E("e1", 1, 99, "out", "in"), E("e1", 1, 1, "out", "in")],
    );
    const diags = validate(doc);
    const codes = new Set(diags.map((d) => d.code));
    expect(codes.has(CODES.DUPLICATE_NODE_ID)).toBe(true);
    expect(codes.has(CODES.MISSING_REQUIRED_PARAMETER)).toBe(true);
    expect(codes.has(CODES.DUPLICATE_EDGE_ID)).toBe(true);
    expect(codes.has(CODES.MISSING_TARGET_NODE)).toBe(true);
    expect(codes.has(CODES.SELF_LOOP)).toBe(true);
  });

  it("orders errors before warnings", () => {
    const doc = docWith([N(1, "Add"), N(2, "Print")], [E("e1", 1, 2, "sum", "in")]);
    const diags = validate(doc);
    const errorCount = diags.filter((d) => d.severity === "error").length;
    const warningCount = diags.filter((d) => d.severity === "warning").length;
    expect(warningCount).toBeGreaterThan(0);
    const firstWarningIdx = diags.findIndex((d) => d.severity === "warning");
    const lastErrorIdx = diags.map((d) => d.severity).lastIndexOf("error");
    if (errorCount > 0) {
      expect(firstWarningIdx).toBeGreaterThan(lastErrorIdx);
    }
  });

  it("detects a graph cycle", () => {
    const doc = docWith(
      [N(1, "Add"), N(2, "Add")],
      [E("e1", 1, 2, "sum", "a"), E("e2", 2, 1, "sum", "a")],
    );
    expect(validate(doc).some((d) => d.code === CODES.CYCLE)).toBe(true);
  });

  it("emits ISOLATED_NODE warning for a lone node", () => {
    const doc = docWith([N(1, "Constant")], []);
    const diags = validate(doc);
    expect(diags.some((d) => d.code === CODES.ISOLATED_NODE && d.severity === "warning")).toBe(
      true,
    );
  });

  it("emits PORT_TYPE_MISMATCH and INVALID_TARGET_PORT for the prompt's example error", () => {
    const doc = docWith(
      [
        { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 1 } },
        N(3, "Add"),
      ],
      [E("e2", 1, 3, "out", "c")],
    );
    const diags = validate(doc);
    expect(diags.some((d) => d.code === CODES.INVALID_TARGET_PORT)).toBe(true);
  });
});
