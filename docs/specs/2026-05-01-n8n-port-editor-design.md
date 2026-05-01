---
title: n8n-port — Graph Editor for an External C++ DAG Runtime
date: 2026-05-01
status: approved
target: brainstorming output, immutable record
---

# n8n-port — Graph Editor Design Spec

## 1. Context

An external C++ DAG runtime (`GraphMT`, `NodeMT`, `EdgeMT`) executes acyclic graphs of typed compute nodes. The runtime is **not present in this repository**. This project provides a Vue 3 web editor that produces a versioned `GraphDocument` JSON that the external runtime can ingest. Background and runtime contract are captured in `N8N_GRAPH_EDITOR_ADAPTATION_PROMPT.md` at the repository root; that file is the source of truth for runtime semantics.

## 2. Goals

- Vue 3 + Vue Flow web editor matching n8n's UX patterns where they translate.
- Versioned graph JSON document model with full backward-compatibility for legacy fixtures.
- Structured validation with diagnostic codes, paths, and severities.
- Palette, property panel, drag-to-connect, undo/redo, copy/paste, search.
- Run-result import overlay (no in-browser execution).
- Test coverage matching the prompt's "Suggested Validation Tests" plus end-to-end Playwright flows.

## 3. Non-goals

- In-repo C++.
- In-browser graph execution.
- n8n workflow-JSON compatibility.
- Backend persistence or multi-user collaboration.
- Generic node-type plugin system in v1 (built-ins only; extensible registry but not user-pluggable).

## 4. Module boundaries

```
src/
  document/      Pure data: GraphDocument types, helpers, ID allocation.
  registry/      NodeTypeRegistry + builtIns (Constant, Add, Print).
  serializer/    Legacy loader (read-only) and versioned loader/saver.
  validator/     GraphDocument -> Diagnostic[]. Pure function.
  compiler/      GraphDocument -> runtime-bound JSON (canonical export).
  editor/
    components/    Canvas, Palette, PropertyPanel, ValidationPanel, TopBar, etc.
    stores/        Pinia: documentStore, editorStore, historyStore,
                   clipboardStore, validationStore, executionStore.
    composables/   useCanvasOperations, useUndo, useShortcuts, useClipboard,
                   useAutosave.
tests/
  unit/          Per-module Vitest specs.
  e2e/           Playwright flows.
fixtures/        Sample graphs (legacy + versioned + run-results).
docs/
  specs/         This file and any future specs.
  decisions/     ADRs.
```

Stores own state; composables own behaviour; components own rendering. Pure functions (validator, serializer, compiler) take and return data — no Vue or store imports.

## 5. Data flow

```
fixtures / user JSON ─┐
                      ├─► serializer ─► GraphDocument ─► documentStore
   editor edits ──────┘                       │
                                              ├─► validator ─► validationStore
                                              ├─► compiler  ─► runtime-bound JSON (download)
                                              └─► executionStore ◄── RunResult JSON (import)
```

## 6. Schemas

### 6.1 `GraphDocument` (canonical save format)

Exactly the prompt's "New Graph Document Format". Top-level fields: `version: 1`, `graph: { nodes, edges, viewport }`. `nodes[]` carry `{id:int, name?:string, type:string, position:{x,y}, parameters:object, frequency_hz: number|null}`. `edges[]` carry `{id:string, source:{node:int,port:string}, target:{node:int,port:string}}`. `viewport: {x,y,zoom}`.

### 6.2 `NodeTypeDescription`

Exactly the prompt's shape: `{type, display_name, category, inputs:[{name,type}], outputs:[{name,type}], parameters: {<key>: {type, required, default}}}`. Lives in the registry; consumed by canvas, palette, property panel, and validator.

### 6.3 `Diagnostic`

Exactly the prompt's shape: `{severity:"error"|"warning", code:string, message:string, node_id?:int, edge_id?:string, field?:string}`.

### 6.4 `RunResult` (defined here)

```jsonc
{
  "version": 1,
  "graph_id": "string|null",
  "ticks": [
    {
      "tick": 0,
      "started_at_ns": 0,
      "duration_ns": 0,
      "nodes": [
        {
          "id": 3,
          "outputs": { "<port>": <value> },
          "duration_ns": 12345,
          "error": null
        }
      ]
    }
  ]
}
```

`outputs` values are typed at the port level; the editor reads them as `unknown` and renders by `NodeTypeDescription` output port type. Single-tick consumption is the v1 target; multi-tick browsing is a Phase-4 stretch goal.

### 6.5 Legacy JSON (read-only)

Detected by top-level `nodes` and `edges` without top-level `version`. Loader assigns deterministic default positions when missing and synthesises edge IDs as `e<src>_<srcPort>__<dst>_<dstPort>`. Once loaded, treated identically to a versioned document; saving emits versioned JSON only.

All five schemas are backed by Zod.

## 7. Built-in nodes (initial registry)

| type | inputs | outputs | parameters |
|---|---|---|---|
| `Constant` | (none) | `out: int` | `value: int` (required, default 0) |
| `Add` | `a: int`, `b: int` | `sum: int` | (none) |
| `Print` | `in: int` | (none) | (none) |

Defined in `src/registry/builtIns.ts`. The registry is extensible (a future `register(NodeTypeDescription, factory?)` API), but exposes only built-ins in v1.

## 8. Validator rules

Errors: duplicate node IDs · missing node IDs · unknown node type · missing required parameter · parameter type mismatch · invalid frequency (non-positive) · frequency for missing node · duplicate edge ID · missing source node · missing target node · invalid source output port · invalid target input port · port type mismatch (when both ports declare types) · self-loop · cycle.

Warnings: isolated node · unconnected required input port.

Triggers: on document load · live on edit, debounced 200 ms · before save (warn but allow) · before runtime-bound-JSON export (block on any error).

## 9. Undo / redo

Command pattern. Each canvas operation produces a `Command` with `do(state)` and `undo(state)`. Multi-select operations bundle into a `CompositeCommand`. `historyStore` maintains forward/backward stacks. Bounded depth (default 200). Recorded in ADR-0004.

## 10. Persistence

Save: trigger browser download of canonical JSON via `<a download>`. Load: `<input type="file">`, Zod-validated parse. **File System Access API** behind feature detection for in-place save on Chromium. Autosave to `localStorage` every 5 s while dirty; restore on app boot with explicit user prompt. Recorded in ADR-0005.

## 11. UI

- **Top bar**: New · Open · Save · Save As · Import RunResult · Validate · Mode toggle (Edit ↔ Inspect).
- **Left panel**: search-driven palette, vuedraggable; categories Input / Math / Output.
- **Centre**: VueFlow canvas with custom node template that reads `NodeTypeDescription` to render typed/named handles. Background grid, controls, minimap.
- **Right panel**: PropertyPanel — node name, parameter inputs (typed), `frequency_hz` field, displayed validation messages scoped to the selected node.
- **Bottom panel**: ValidationPanel — Diagnostic list grouped by severity; clicking a diagnostic selects the offending node/edge.

Element Plus components for buttons, inputs, dialogs. lucide-vue-next for icons.

## 12. Phase plan

| Phase | Deliverables | Acceptance |
|---|---|---|
| **0** | `PROJECT_MEMORY.md`, `PLAN.md`, this spec, ADRs 0001-0006, `README.md`, `.gitignore`, `CHANGELOG.md`, `git init`, initial commit | All listed files exist; repo committed |
| **1** | `src/document`, `src/registry`, `src/serializer`, `src/validator`, `src/compiler`, full Vitest suites, fixtures | Both prompt fixtures load/round-trip; every "Suggested Validation Test" green; CI on |
| **2** | Vite app, VueFlow canvas, palette, Constant property panel, drag-to-connect, save/load | User can recreate simple-add graph, save, reload — document equal up to deterministic ordering |
| **3** | search palette, undo/redo, copy/paste, validation panel, fit-view, autolayout (Dagre), keyboard shortcuts | Dozens of nodes stable; every operation undoable; Playwright e2e green |
| **4** | RunResult import + Zod schema, per-node value/error/duration overlays, mode toggle | Importing a sample run-result renders on canvas; toggling mode cleans overlays; persisted graph unchanged |

## 13. Test strategy

- **Unit (Vitest)**: every pure module — document, registry, serializer, validator, compiler — plus stores and composables with mocked dependencies. Aim ≥90% line coverage on pure modules.
- **Component (@vue/test-utils + happy-dom)**: palette, property panel, validation panel, custom node template.
- **E2E (Playwright)**: build simple-add graph from blank canvas; load and round-trip parallel-add fixture; trigger and resolve each validator error class; import RunResult and verify overlay rendering.

## 14. CI

GitHub Actions workflow on push/PR: pnpm install (frozen lockfile) → eslint → tsc --noEmit → vitest --run → vite build → playwright. Cache pnpm store and Playwright browsers.

## 15. Multi-session ergonomics

`PROJECT_MEMORY.md` is the durable cross-session source of truth (architecture, conventions, decision pointers). `PLAN.md` is the active checklist, updated every session. ADRs in `docs/decisions/`. `CHANGELOG.md` per-phase summary. Conventional commits. Pre-commit hook (Phase 1+) runs format + typecheck + tests-on-changed.

## 16. Decisions referenced

- ADR-0001 — Editor-only, no in-repo C++ runtime
- ADR-0002 — Vue 3 + Vue Flow stack (n8n parity)
- ADR-0003 — Zod for runtime validation
- ADR-0004 — Command-pattern undo/redo
- ADR-0005 — Persistence: download/upload + localStorage autosave
- ADR-0006 — Phase-4 reinterpreted as RunResult import

## 17. Open questions (carried into Phase 1+)

- Should `frequency_hz` be editable in the property panel from Phase 2, or deferred to Phase 3? (Default: Phase 3.)
- Should the registry expose a public `register()` API at all in v1, or stay internal until a real second consumer appears? (Default: internal in v1.)
- Should we ship a CLI bundle (`node` script) for headless validation/compilation alongside the editor? (Default: deferred to Phase 4 polish if requested.)

These are non-blocking and will be revisited as their phases approach.
