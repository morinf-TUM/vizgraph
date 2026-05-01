import type { GraphDocument } from "../document/types";
import { defaultRegistry, type NodeTypeRegistry } from "../registry/registry";
import type { Diagnostic } from "./diagnostics";
import { checkDuplicateNodeIds, checkDuplicateEdgeIds } from "./rules/ids";
import { checkMissingEdgeEndpoints, checkSelfLoops } from "./rules/edges";
import {
  checkInvalidSourcePort,
  checkInvalidTargetPort,
  checkPortTypeMismatch,
} from "./rules/ports";
import {
  checkUnknownNodeTypes,
  checkMissingRequiredParameters,
  checkParameterTypeMismatch,
} from "./rules/params";
import { checkInvalidFrequency } from "./rules/freq";
import { checkCycles } from "./rules/cycles";
import { checkIsolatedNodes, checkUnconnectedInputs } from "./rules/warnings";

// Errors first, warnings last. Within each band, structural rules (id and
// edge integrity) precede semantic rules (types, ports, parameters), and
// cycle detection comes after structural soundness so cycle messages
// reference resolvable edges only.
export const validate = (
  doc: GraphDocument,
  registry: NodeTypeRegistry = defaultRegistry(),
): Diagnostic[] => [
  ...checkDuplicateNodeIds(doc),
  ...checkDuplicateEdgeIds(doc),
  ...checkMissingEdgeEndpoints(doc),
  ...checkSelfLoops(doc),
  ...checkUnknownNodeTypes(doc, registry),
  ...checkMissingRequiredParameters(doc, registry),
  ...checkParameterTypeMismatch(doc, registry),
  ...checkInvalidFrequency(doc),
  ...checkInvalidSourcePort(doc, registry),
  ...checkInvalidTargetPort(doc, registry),
  ...checkPortTypeMismatch(doc, registry),
  ...checkCycles(doc),
  ...checkIsolatedNodes(doc),
  ...checkUnconnectedInputs(doc, registry),
];
