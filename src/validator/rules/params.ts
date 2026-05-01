import type { GraphDocument } from "../../document/types";
import type { NodeTypeRegistry } from "../../registry/registry";
import { CODES } from "../codes";
import { error, type Diagnostic } from "../diagnostics";

// Parameter type strings recognised here. Unknown strings (e.g. "tensor3d")
// are accepted forward-compat: the validator emits no diagnostic, leaving the
// runtime to enforce. This avoids breaking on registries extended in later
// phases without changes to the validator.
const matchesType = (type: string, value: unknown): boolean => {
  switch (type) {
    case "int":
      return typeof value === "number" && Number.isInteger(value);
    case "float":
    case "number":
      return typeof value === "number";
    case "string":
      return typeof value === "string";
    case "bool":
    case "boolean":
      return typeof value === "boolean";
    default:
      return true;
  }
};

export const checkUnknownNodeTypes = (
  doc: GraphDocument,
  registry: NodeTypeRegistry,
): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];
  for (const node of doc.graph.nodes) {
    if (!registry.get(node.type)) {
      diagnostics.push(
        error({
          code: CODES.UNKNOWN_NODE_TYPE,
          message: `Node ${String(node.id)} has unknown type ${node.type}.`,
          node_id: node.id,
        }),
      );
    }
  }
  return diagnostics;
};

export const checkMissingRequiredParameters = (
  doc: GraphDocument,
  registry: NodeTypeRegistry,
): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];
  for (const node of doc.graph.nodes) {
    const desc = registry.get(node.type);
    if (!desc) continue;
    for (const [paramName, paramDesc] of Object.entries(desc.parameters)) {
      if (paramDesc.required && node.parameters[paramName] === undefined) {
        diagnostics.push(
          error({
            code: CODES.MISSING_REQUIRED_PARAMETER,
            message: `Node ${String(node.id)} of type ${desc.type} is missing required parameter ${paramName}.`,
            node_id: node.id,
            field: `parameters.${paramName}`,
          }),
        );
      }
    }
  }
  return diagnostics;
};

export const checkParameterTypeMismatch = (
  doc: GraphDocument,
  registry: NodeTypeRegistry,
): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];
  for (const node of doc.graph.nodes) {
    const desc = registry.get(node.type);
    if (!desc) continue;
    for (const [paramName, paramDesc] of Object.entries(desc.parameters)) {
      const value = node.parameters[paramName];
      if (value === undefined) continue;
      if (!matchesType(paramDesc.type, value)) {
        diagnostics.push(
          error({
            code: CODES.PARAMETER_TYPE_MISMATCH,
            message: `Node ${String(node.id)} parameter ${paramName} expects ${paramDesc.type}.`,
            node_id: node.id,
            field: `parameters.${paramName}`,
          }),
        );
      }
    }
  }
  return diagnostics;
};
