import { loadVersioned, saveVersioned } from "./versioned";
import { safeLoadLegacy } from "./legacy";
import type { LoadResult } from "./versioned";

export type { LoadResult };
export { loadVersioned, saveVersioned, safeLoadLegacy };

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

export const loadGraph = (input: unknown): LoadResult => {
  if (!isObject(input)) {
    return { success: false, error: "graph JSON must be an object" };
  }
  if ("version" in input && "graph" in input) return loadVersioned(input);
  if ("nodes" in input && "edges" in input) return safeLoadLegacy(input);
  return {
    success: false,
    error:
      "graph JSON must have either { version, graph } (versioned) or { nodes, edges } (legacy)",
  };
};
