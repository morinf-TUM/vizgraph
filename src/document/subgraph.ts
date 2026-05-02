import * as z from "zod";
import { GraphDocumentSchema, type GraphDocument } from "./types";

export const SUBGRAPH_NODE_TYPE = "Subgraph";
export const SUBGRAPH_INPUT_NODE_TYPE = "SubgraphInput";
export const SUBGRAPH_OUTPUT_NODE_TYPE = "SubgraphOutput";

export const RESERVED_SUBGRAPH_TYPES: readonly string[] = [
  SUBGRAPH_NODE_TYPE,
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
];

export const SubgraphParametersSchema: z.ZodType<{ children: GraphDocument }> = z.object({
  children: z.lazy(() => GraphDocumentSchema),
});

export const PseudoPortParametersSchema = z.object({
  name: z.string().min(1),
  portType: z.string().min(1),
});

export type SubgraphParameters = z.infer<typeof SubgraphParametersSchema>;
export type PseudoPortParameters = z.infer<typeof PseudoPortParametersSchema>;
