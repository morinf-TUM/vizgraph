import * as z from "zod";

// Spec §6.4: RunResult is the editor's read-only view of one runtime
// execution. Single-tick is the v1 target; multi-tick browsing is a
// Phase-4 stretch goal (the schema already supports it). `outputs` values
// are arbitrary JSON typed at the port level; the editor reads them as
// `unknown` and renders by NodeTypeDescription output port type.

export const RunResultNodeSchema = z.object({
  id: z.number().int(),
  outputs: z.record(z.string(), z.unknown()).default({}),
  duration_ns: z.number().nonnegative(),
  error: z.string().nullable(),
});
export type RunResultNode = z.infer<typeof RunResultNodeSchema>;

export const RunResultTickSchema = z.object({
  tick: z.number().int().nonnegative(),
  started_at_ns: z.number().nonnegative(),
  duration_ns: z.number().nonnegative(),
  nodes: z.array(RunResultNodeSchema),
});
export type RunResultTick = z.infer<typeof RunResultTickSchema>;

export const RunResultSchema = z.object({
  version: z.literal(1),
  graph_id: z.string().nullable(),
  ticks: z.array(RunResultTickSchema).min(1),
});
export type RunResult = z.infer<typeof RunResultSchema>;
