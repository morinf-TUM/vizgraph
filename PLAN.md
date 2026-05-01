# PLAN — n8n-port

> Active checklist. Update each session. Source of truth for the next concrete action.

**Active phase:** Phase 2 — Minimal Visual Editor.
**Next phase on close:** Phase 3 — n8n-inspired UX.

---

## Phase 0 — Analysis & Decision

- [x] Brainstorm and lock stack/scope/architecture.
- [x] Write design spec → `docs/specs/2026-05-01-n8n-port-editor-design.md`.
- [x] Write `PROJECT_MEMORY.md`.
- [x] Write `PLAN.md` (this file).
- [x] Write ADRs 0001–0006 in `docs/decisions/`.
- [x] Write `README.md` skeleton.
- [x] Write `.gitignore`, `CHANGELOG.md`.
- [x] `git init` and initial commit.
- [x] Spec self-review pass (placeholders / contradictions / ambiguity / scope).
- [x] User reviews spec; gate before Phase 1. *(approved by user; option B in 2026-05-01 session)*

## Phase 1 — Schema & Runtime Adapter

Prerequisite: upgrade Node to 22 LTS on dev machine; `corepack enable && corepack use pnpm@latest-10`.

- [x] Scaffold project: `pnpm init`, install deps, configure TS strict, ESLint, Prettier, Vitest, Vite. *(Plan Task 1 complete on `phase-1-schema-and-adapter` — six commits: `fc764de` initial configs, `1fb6251` flat-ESLint + verified pins, `f88d675` packageManager fully-qualified pin, `3d7cb92` install + smoke test + verify. Toolchain green: `pnpm test/lint/format:check/typecheck` all exit 0. Spec ✅, code-quality ✅.)*
- [x] `src/document/types.ts` — `GraphDocument`, `Node`, `Edge`, `Viewport` types and Zod schemas.
- [x] `src/document/ids.ts` — node-ID and edge-ID allocators (deterministic, monotonic).
- [x] `src/registry/types.ts` — `NodeTypeDescription` Zod schema and TS type.
- [x] `src/registry/builtIns.ts` — `Constant`, `Add`, `Print` definitions.
- [x] `src/registry/registry.ts` — registry API (`get(type)`, `all()`, `register()` internal-only).
- [x] `src/serializer/legacy.ts` — read-only legacy loader → `GraphDocument`.
- [x] `src/serializer/versioned.ts` — versioned load/save round-trip.
- [x] `src/serializer/index.ts` — auto-detect legacy vs versioned.
- [x] `src/validator/diagnostics.ts` — `Diagnostic` type, code constants.
- [x] `src/validator/rules/*.ts` — one file per rule class (ids, edges, ports, params, freq, cycles, warnings). *(`CODES.FREQUENCY_FOR_MISSING_NODE` reserved-but-not-implemented; current schema keeps `frequency_hz` on the node so the code is unreachable. Documented in the freq.ts header.)*
- [x] `src/validator/validate.ts` — orchestrator returning `Diagnostic[]`.
- [x] `src/compiler/compile.ts` — `GraphDocument` → runtime-bound JSON. *(Output is legacy JSON + optional `frequency_hz` per node; throws on Constant invariant violations as belt-and-suspenders for callers that bypass `validate()`.)*
- [x] `fixtures/legacy/simple-add.json` — from prompt §"Simple Add Graph".
- [x] `fixtures/legacy/parallel-add.json` — from prompt §"Parallel Add Graph".
- [x] `fixtures/versioned/simple-add.json` — round-trip target. *(Matches the legacy-loader output: `x = idx * 200`, edge ids via `e<src>_<srcPort>__<dst>_<dstPort>`.)*
- [x] Unit tests: every "Suggested Validation Test" from the prompt as a Vitest case. *(C++ execution tests are out-of-repo; all editor-side validator cases covered across `ids/edges/ports/params/freq/cycles/warnings` + `validate.test.ts` + `fixtures.test.ts`.)*
- [x] Unit tests: legacy → versioned round-trip preserves IDs, names, parameters, edge endpoints, positions. *(`tests/unit/fixtures.test.ts`.)*
- [x] CI: GitHub Actions workflow (lint + typecheck + vitest + build). *(Build step deferred to Phase 2 — no Vite build configured yet.)*
- [x] Tag `phase-1-complete`, update `CHANGELOG.md`.

## Phase 2 — Minimal Visual Editor

- [ ] `src/main.ts`, `src/App.vue` — Vite entry, Element Plus + lucide registration.
- [ ] `src/editor/stores/documentStore.ts` — Pinia store wrapping `GraphDocument`.
- [ ] `src/editor/stores/editorStore.ts` — selection, viewport, dirty flag.
- [ ] `src/editor/components/CanvasView.vue` — VueFlow canvas with custom node template.
- [ ] `src/editor/components/CustomNode.vue` — renders typed handles from `NodeTypeDescription`.
- [ ] `src/editor/components/Palette.vue` — categorised node list, click or drag to add.
- [ ] `src/editor/components/PropertyPanel.vue` — at minimum, edits `Constant.value`.
- [ ] `src/editor/components/TopBar.vue` — New, Open, Save, Save As.
- [ ] `src/editor/composables/useCanvasOperations.ts` — add/move/connect/delete primitives.
- [ ] `src/editor/composables/useFileIO.ts` — download save, file-picker load (with Zod parse).
- [ ] Connection validation: reject edges that violate `NodeTypeDescription` port-type rules.
- [ ] Playwright e2e: build simple-add graph from blank canvas, save, reload, document equal.
- [ ] Tag `phase-2-complete`, update `CHANGELOG.md`.

## Phase 3 — n8n-inspired UX

- [ ] `src/editor/stores/historyStore.ts` — command stack, bounded depth.
- [ ] `src/editor/composables/useUndo.ts` — keyboard shortcuts, expose API.
- [ ] Convert canvas operations to `Command` objects.
- [ ] `src/editor/stores/clipboardStore.ts` — copy/paste of selection (handles ID re-assignment).
- [ ] Search-driven palette (filter by name, type, category).
- [ ] `src/editor/components/ValidationPanel.vue` — Diagnostic list, click-to-jump.
- [ ] Live debounced validation (200 ms) on every document mutation.
- [ ] Fit-view, zoom controls (already in Vue Flow controls; wire keyboard shortcuts).
- [ ] Auto-layout (Dagre) — "tidy" command.
- [ ] Keyboard shortcuts: Ctrl+Z/Y, Ctrl+C/V, Delete, Ctrl+S, Ctrl+O, F (fit-view).
- [ ] Playwright e2e: trigger and resolve each validator error class; verify undo/redo.
- [ ] Tag `phase-3-complete`, update `CHANGELOG.md`.

## Phase 4 — Run-Result Import & Observability

- [ ] `src/document/runresult.ts` — `RunResult` type and Zod schema.
- [ ] `src/editor/stores/executionStore.ts` — current run-result, current tick, overlay map.
- [ ] `src/editor/components/CustomNode.vue` — overlay rendering (output values, duration, error).
- [ ] Mode toggle in TopBar (Edit ↔ Inspect).
- [ ] `src/editor/composables/useRunResultImport.ts` — file picker + Zod parse + bind to graph.
- [ ] Multi-tick browsing (stretch): tick slider in TopBar.
- [ ] Playwright e2e: import sample run-result, verify overlay values, toggle mode, verify clean state.
- [ ] Tag `phase-4-complete`, update `CHANGELOG.md`.

## Cross-cutting / continuous

- [ ] Keep `PROJECT_MEMORY.md` current at end of every session.
- [ ] Keep `CHANGELOG.md` current at every phase boundary.
- [ ] Pre-commit hook (Phase 1+): format, lint, typecheck, vitest on changed.
- [ ] CI green before tagging any phase complete.

## Backlog (post-Phase-4 ideas, not committed)

- Plugin/external node-type registration API.
- Headless CLI for validation and compilation.
- Theming (n8n-style dark theme, accessibility audit).
- Sub-graphs / grouping.
- Comments / annotations on nodes and edges.
