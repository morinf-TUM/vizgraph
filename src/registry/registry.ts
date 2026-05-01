import { NodeTypeDescriptionSchema, type NodeTypeDescription } from "./types";
import { BUILT_IN_NODE_TYPES } from "./builtIns";

export interface RegisterOptions {
  // When true, replace an existing description with the same `type`. Default
  // is false, in which case re-registering throws so plugins can't silently
  // override an earlier registration.
  replace?: boolean;
}

export interface NodeTypeRegistry {
  get(type: string): NodeTypeDescription | undefined;
  has(type: string): boolean;
  all(): NodeTypeDescription[];
  register(description: NodeTypeDescription, options?: RegisterOptions): void;
  unregister(type: string): boolean;
}

export const createRegistry = (descriptions: readonly NodeTypeDescription[]): NodeTypeRegistry => {
  const byType = new Map<string, NodeTypeDescription>();
  for (const d of descriptions) byType.set(d.type, d);

  const register = (description: NodeTypeDescription, options: RegisterOptions = {}): void => {
    // Re-parse through the schema so plugin authors get the same Zod
    // diagnostics the loader path would produce. This is the public boundary
    // for third-party input.
    const validated = NodeTypeDescriptionSchema.parse(description);
    if (byType.has(validated.type) && options.replace !== true) {
      throw new Error(
        `Node type "${validated.type}" is already registered. Pass { replace: true } to override.`,
      );
    }
    byType.set(validated.type, validated);
  };

  return {
    get: (type) => byType.get(type),
    has: (type) => byType.has(type),
    all: () => [...byType.values()],
    register,
    unregister: (type) => byType.delete(type),
  };
};

let _default: NodeTypeRegistry | undefined;
export const defaultRegistry = (): NodeTypeRegistry => {
  if (!_default) _default = createRegistry(BUILT_IN_NODE_TYPES);
  return _default;
};
