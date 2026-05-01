# ADR-0002 — Vue 3 + Vue Flow stack (n8n parity)

**Status:** accepted (2026-05-01)

## Context

The project's stated priority is to remain as close as possible to n8n's editor UX. The editor stack candidates were:

- **A. React + React Flow** — broader ecosystem, more docs.
- **B. Vue 3 + Vue Flow** — same as n8n.
- **C. Native C++ + ImGui/imnodes** — out of scope under ADR-0001.

n8n's current `packages/frontend/editor-ui/package.json` (verified on `master`, 2026-05-01) declares:

- `vue` (Vue 3)
- `@vue-flow/core` 1.48.0 with `background`, `controls`, `minimap`, `node-resizer`
- `vite`
- `pinia`
- `element-plus`
- `vitest`
- `@dagrejs/dagre`
- `vuedraggable`

## Decision

Option B. Adopt the same stack as n8n. Vue Flow is itself a port of React Flow, so the canvas APIs are similar; n8n's specific handle styling, edge routing, slot-based custom node templates, and Pinia store integration are Vue-native and would otherwise need re-mapping into React.

## Consequences

- n8n source code reads directly as a reference for our patterns. We adapt; we do not copy.
- Smaller candidate-developer pool than React, accepted.
- Vue Flow's docs (`https://vueflow.dev`) are the authoritative reference for canvas behaviour. We will verify against current docs before each non-obvious canvas decision.
- TypeScript strict + Composition API throughout; no Options API.
