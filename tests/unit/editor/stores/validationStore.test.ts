import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useValidationStore } from "../../../../src/editor/stores/validationStore";
import type { Diagnostic } from "../../../../src/validator/diagnostics";

describe("validationStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts empty", () => {
    const v = useValidationStore();
    expect(v.diagnostics).toEqual([]);
    expect(v.errors).toEqual([]);
    expect(v.warnings).toEqual([]);
    expect(v.hasErrors).toBe(false);
  });

  it("setDiagnostics partitions into errors and warnings", () => {
    const v = useValidationStore();
    const diags: Diagnostic[] = [
      { severity: "error", code: "duplicate_node_id", message: "x", node_id: 1 },
      { severity: "warning", code: "isolated_node", message: "y", node_id: 2 },
      { severity: "error", code: "self_loop", message: "z", edge_id: "e1" },
    ];
    v.setDiagnostics(diags);
    expect(v.diagnostics).toHaveLength(3);
    expect(v.errors.map((d) => d.code)).toEqual(["duplicate_node_id", "self_loop"]);
    expect(v.warnings.map((d) => d.code)).toEqual(["isolated_node"]);
    expect(v.hasErrors).toBe(true);
  });
});
