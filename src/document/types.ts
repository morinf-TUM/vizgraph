import * as z from "zod";

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type Position = z.infer<typeof PositionSchema>;

export const NodeSchema = z.object({
  id: z.number().int(),
  name: z.string().optional(),
  type: z.string(),
  position: PositionSchema,
  parameters: z.record(z.string(), z.unknown()).default({}),
  frequency_hz: z.number().positive().nullable().optional(),
});
export type GraphNode = z.infer<typeof NodeSchema>;

export const EdgeEndpointSchema = z.object({
  node: z.number().int(),
  port: z.string(),
});
export type EdgeEndpoint = z.infer<typeof EdgeEndpointSchema>;

export const EdgeSchema = z.object({
  id: z.string(),
  source: EdgeEndpointSchema,
  target: EdgeEndpointSchema,
});
export type GraphEdge = z.infer<typeof EdgeSchema>;

export const ViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().positive(),
});
export type Viewport = z.infer<typeof ViewportSchema>;

export const CommentSchema = z.object({
  id: z.string(),
  text: z.string(),
  position: PositionSchema,
  size: z
    .object({
      width: z.number().positive(),
      height: z.number().positive(),
    })
    .optional(),
  color: z.string().optional(),
});
export type Comment = z.infer<typeof CommentSchema>;

export const GraphSchema = z.object({
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
  viewport: ViewportSchema.optional(),
  // Editor-only annotations. Persist with the document (so reviewers see the
  // same comments) but never reach the runtime — the compiler strips them.
  comments: z.array(CommentSchema).default([]),
});
export type Graph = z.infer<typeof GraphSchema>;

export const GraphDocumentSchema = z.object({
  version: z.literal(1),
  graph: GraphSchema,
});
export type GraphDocument = z.infer<typeof GraphDocumentSchema>;
