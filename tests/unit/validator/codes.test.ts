import { describe, it, expect } from "vitest";
import { CODES, type DiagnosticCode } from "../../../src/validator/codes";

describe("validator codes", () => {
  it("exposes a stable set of error and warning codes", () => {
    expect(CODES.DUPLICATE_NODE_ID).toBe("duplicate_node_id");
    expect(CODES.UNKNOWN_NODE_TYPE).toBe("unknown_node_type");
    expect(CODES.MISSING_REQUIRED_PARAMETER).toBe("missing_required_parameter");
    expect(CODES.PARAMETER_TYPE_MISMATCH).toBe("parameter_type_mismatch");
    expect(CODES.INVALID_FREQUENCY).toBe("invalid_frequency");
    expect(CODES.FREQUENCY_FOR_MISSING_NODE).toBe("frequency_for_missing_node");
    expect(CODES.DUPLICATE_EDGE_ID).toBe("duplicate_edge_id");
    expect(CODES.MISSING_SOURCE_NODE).toBe("missing_source_node");
    expect(CODES.MISSING_TARGET_NODE).toBe("missing_target_node");
    expect(CODES.INVALID_SOURCE_PORT).toBe("invalid_source_port");
    expect(CODES.INVALID_TARGET_PORT).toBe("invalid_target_port");
    expect(CODES.PORT_TYPE_MISMATCH).toBe("port_type_mismatch");
    expect(CODES.SELF_LOOP).toBe("self_loop");
    expect(CODES.CYCLE).toBe("cycle");
    expect(CODES.ISOLATED_NODE).toBe("isolated_node");
    expect(CODES.UNCONNECTED_INPUT).toBe("unconnected_input");
  });

  it("DiagnosticCode is the union of CODES values", () => {
    const _check: DiagnosticCode = "duplicate_node_id";
    expect(_check).toBe(CODES.DUPLICATE_NODE_ID);
  });
});
