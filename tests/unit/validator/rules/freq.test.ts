import { describe, it, expect } from "vitest";
import { checkInvalidFrequency } from "../../../../src/validator/rules/freq";
import type { GraphDocument } from "../../../../src/document/types";
import { CODES } from "../../../../src/validator/codes";

// These tests bypass Zod (which enforces frequency_hz > 0 at parse time) to
// exercise the validator as a defensive layer against direct mutation in
// reactive editor stores.
const docWithFrequencies = (freqs: ReadonlyArray<number | null | undefined>): GraphDocument => ({
  version: 1,
  graph: {
    nodes: freqs.map((f, i) => ({
      id: i + 1,
      type: "Print",
      position: { x: 0, y: 0 },
      parameters: {},
      ...(f === undefined ? {} : { frequency_hz: f }),
    })),
    edges: [],
    comments: [],
  },
});

describe("checkInvalidFrequency", () => {
  it("returns no diagnostics when all frequencies are positive, null, or omitted", () => {
    expect(checkInvalidFrequency(docWithFrequencies([60, null, undefined, 0.001]))).toEqual([]);
  });

  it("emits INVALID_FREQUENCY for zero", () => {
    const diags = checkInvalidFrequency(docWithFrequencies([0]));
    expect(diags).toHaveLength(1);
    expect(diags[0]?.code).toBe(CODES.INVALID_FREQUENCY);
    expect(diags[0]?.severity).toBe("error");
    expect(diags[0]?.node_id).toBe(1);
    expect(diags[0]?.field).toBe("frequency_hz");
  });

  it("emits INVALID_FREQUENCY for negative numbers", () => {
    const diags = checkInvalidFrequency(docWithFrequencies([-5]));
    expect(diags).toHaveLength(1);
    expect(diags[0]?.code).toBe(CODES.INVALID_FREQUENCY);
    expect(diags[0]?.node_id).toBe(1);
  });

  it("emits INVALID_FREQUENCY for NaN and infinity", () => {
    const diags = checkInvalidFrequency(docWithFrequencies([Number.NaN, Number.POSITIVE_INFINITY]));
    expect(diags).toHaveLength(2);
    for (const d of diags) {
      expect(d.code).toBe(CODES.INVALID_FREQUENCY);
    }
  });

  it("emits one diagnostic per offending node, in document order", () => {
    const diags = checkInvalidFrequency(docWithFrequencies([60, -1, null, 0]));
    expect(diags.map((d) => d.node_id)).toEqual([2, 4]);
  });
});
