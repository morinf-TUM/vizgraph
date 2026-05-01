import type { NodeTypeDescription } from "./types";
import { BUILT_IN_NODE_TYPES } from "./builtIns";

export interface NodeTypeRegistry {
  get(type: string): NodeTypeDescription | undefined;
  all(): NodeTypeDescription[];
}

export const createRegistry = (descriptions: readonly NodeTypeDescription[]): NodeTypeRegistry => {
  const byType = new Map<string, NodeTypeDescription>();
  for (const d of descriptions) byType.set(d.type, d);
  return {
    get: (type) => byType.get(type),
    all: () => [...byType.values()],
  };
};

let _default: NodeTypeRegistry | undefined;
export const defaultRegistry = (): NodeTypeRegistry => {
  if (!_default) _default = createRegistry(BUILT_IN_NODE_TYPES);
  return _default;
};
