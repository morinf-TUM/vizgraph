import * as z from "zod";
import type { DiagnosticCode } from "./codes";

export const DiagnosticSchema = z.object({
  severity: z.enum(["error", "warning"]),
  code: z.string(),
  message: z.string(),
  node_id: z.number().int().optional(),
  edge_id: z.string().optional(),
  field: z.string().optional(),
  // Chain of Subgraph node ids from root to the level where the offending
  // element lives. Empty/absent = root level.
  path: z.array(z.number().int()).optional(),
});

export type Diagnostic = z.infer<typeof DiagnosticSchema> & { code: DiagnosticCode };

export interface DiagnosticInit {
  code: DiagnosticCode;
  message: string;
  node_id?: number;
  edge_id?: string;
  field?: string;
  path?: number[];
}

export const error = (init: DiagnosticInit): Diagnostic => ({
  ...init,
  severity: "error",
});

export const warning = (init: DiagnosticInit): Diagnostic => ({
  ...init,
  severity: "warning",
});
