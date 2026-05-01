import { GraphDocumentSchema, type GraphDocument } from "../document/types";

export type LoadResult = { success: true; data: GraphDocument } | { success: false; error: string };

export const loadVersioned = (input: unknown): LoadResult => {
  const r = GraphDocumentSchema.safeParse(input);
  if (r.success) return { success: true, data: r.data };
  return { success: false, error: r.error.message };
};

export const saveVersioned = (doc: GraphDocument): string => JSON.stringify(doc, null, 2);
