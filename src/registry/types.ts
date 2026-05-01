import * as z from "zod";

export const ParameterDescriptionSchema = z.object({
  type: z.string(),
  required: z.boolean().optional().default(false),
  default: z.unknown().optional(),
});
export type ParameterDescription = z.infer<typeof ParameterDescriptionSchema>;

export const PortDescriptionSchema = z.object({
  name: z.string(),
  type: z.string().optional(),
});
export type PortDescription = z.infer<typeof PortDescriptionSchema>;

export const NodeTypeDescriptionSchema = z.object({
  type: z.string(),
  display_name: z.string(),
  category: z.string(),
  inputs: z.array(PortDescriptionSchema),
  outputs: z.array(PortDescriptionSchema),
  parameters: z.record(z.string(), ParameterDescriptionSchema),
});
export type NodeTypeDescription = z.infer<typeof NodeTypeDescriptionSchema>;
