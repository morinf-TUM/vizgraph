export const CODES = {
  DUPLICATE_NODE_ID: "duplicate_node_id",
  UNKNOWN_NODE_TYPE: "unknown_node_type",
  MISSING_REQUIRED_PARAMETER: "missing_required_parameter",
  PARAMETER_TYPE_MISMATCH: "parameter_type_mismatch",
  INVALID_FREQUENCY: "invalid_frequency",
  FREQUENCY_FOR_MISSING_NODE: "frequency_for_missing_node",
  DUPLICATE_EDGE_ID: "duplicate_edge_id",
  MISSING_SOURCE_NODE: "missing_source_node",
  MISSING_TARGET_NODE: "missing_target_node",
  INVALID_SOURCE_PORT: "invalid_source_port",
  INVALID_TARGET_PORT: "invalid_target_port",
  PORT_TYPE_MISMATCH: "port_type_mismatch",
  SELF_LOOP: "self_loop",
  CYCLE: "cycle",
  ISOLATED_NODE: "isolated_node",
  UNCONNECTED_INPUT: "unconnected_input",
} as const;

export type DiagnosticCode = (typeof CODES)[keyof typeof CODES];
