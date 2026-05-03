# ADR-0007: Sub-graphs flatten at compile time

**Status:** Accepted (2026-05-02)

The editor supports recursive sub-graph encapsulation with a typed port surface. The compiler flattens the recursive document into the same flat `{nodes, edges}` JSON shape the C++ runtime already consumes; the runtime contract is unchanged. ADR-0001 (editor-only, no in-repo C++) is preserved.

Full design rationale and the rejected alternatives (nested-on-canvas, reusable-types-in-v1, runtime-side recursion, path-prefixed string ids): see `docs/specs/2026-05-02-subgraphs-design.md`.
