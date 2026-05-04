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

export const CommentAttachmentSchema = z.object({
  // At most one of node/edge is set — schema permits both being unset (the
  // empty-attachment shape) but the editor only ever writes one or the other.
  node: z.number().int().optional(),
  edge: z.string().optional(),
});
export type CommentAttachment = z.infer<typeof CommentAttachmentSchema>;

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
  // When set, the comment is anchored to a node or edge: it follows node moves
  // and is auto-detached if its anchor is removed. Absent => free-floating.
  attachedTo: CommentAttachmentSchema.optional(),
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
