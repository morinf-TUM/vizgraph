import type { Graph } from "../../document/types";
import {
  PseudoPortParametersSchema,
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
  SubgraphParametersSchema,
} from "../../document/subgraph";
import { CODES } from "../codes";
import { error, type Diagnostic } from "../diagnostics";

export const checkSubgraphSchema = (graph: Graph, path: number[] = []): Diagnostic[] => {
  const out: Diagnostic[] = [];
  for (const node of graph.nodes) {
    if (node.type === SUBGRAPH_NODE_TYPE) {
      const r = SubgraphParametersSchema.safeParse(node.parameters);
      if (!r.success) {
        const issue = r.error.issues[0];
        out.push(
          error({
            code: CODES.SUBGRAPH_INVALID_PARAMETERS,
            message: `Subgraph node ${String(node.id)} has invalid parameters: ${issue?.message ?? "parse error"}.`,
            node_id: node.id,
            field: issue?.path.join(".") ?? "parameters",
            ...(path.length > 0 ? { path } : {}),
          }),
        );
      }
      continue;
    }
    if (node.type === SUBGRAPH_INPUT_NODE_TYPE || node.type === SUBGRAPH_OUTPUT_NODE_TYPE) {
      const r = PseudoPortParametersSchema.safeParse(node.parameters);
      if (!r.success) {
        const issue = r.error.issues[0];
        out.push(
          error({
            code: CODES.PSEUDO_NODE_INVALID_PARAMETERS,
            message: `${node.type} node ${String(node.id)} has invalid parameters: ${issue?.message ?? "parse error"}.`,
            node_id: node.id,
            field: issue?.path.join(".") ?? "parameters",
            ...(path.length > 0 ? { path } : {}),
          }),
        );
      }
    }
  }
  return out;
};
