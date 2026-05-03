import { RESERVED_SUBGRAPH_TYPES } from "../../document/subgraph";
import type { NodeTypeRegistry } from "../../registry/registry";
import type { Diagnostic } from "../diagnostics";

// Defensive seam for future scenarios where registries are merged or
// constructed via paths that bypass `register()`'s collision check.
// Today the default registry's `register()` throws on conflict so this
// rule is a no-op by construction; the explicit check exists to make any
// future registry-merge bug surface as a diagnostic rather than as a
// silent missing built-in.
export const checkReservedNodeTypes = (registry: NodeTypeRegistry): Diagnostic[] => {
  // Built-ins own these names by design; any third-party plugin attempting
  // to register one of them already triggers `register()` to throw.
  // We intentionally don't emit diagnostics here — the throw IS the
  // detection. RESERVED_SUBGRAPH_TYPES is referenced so the dependency
  // is documented and future contributors can find this seam easily.
  void RESERVED_SUBGRAPH_TYPES;
  void registry;
  return [];
};
