# Changelog

All notable changes are recorded here at every phase boundary or significant milestone.

## [Unreleased]

### Phase 3 — n8n-inspired UX (complete, 2026-05-01, tag `phase-3-complete`)
- Undo/redo via the snapshot/memento variant of ADR-0004: `src/editor/stores/historyStore.ts` exposes `transact(label, fn)`, `undo()`, `redo()`, `clear()`. Bounded at MAX_DEPTH=100. Every `useCanvasOperations` call wraps its mutation in a single transaction so Ctrl+Z reverts a single user action atomically (including the cascade-prune from `removeNode` and multi-target `removeSelected`).
- `src/editor/composables/useUndo.ts`: thin façade for the shortcut/UI layer.
- Clipboard with ID re-assignment (`src/editor/stores/clipboardStore.ts`): `copy` captures selected nodes plus edges fully internal to the selection; `paste` re-allocates IDs via `nextNodeId`, regenerates edge IDs via `edgeIdFor`, offsets positions by 30, and selects the pasted set; `cut` is `copy` + remove in one transaction.
- Live validation: `src/editor/stores/validationStore.ts` (Diagnostic[] split into errors / warnings / hasErrors) + `src/editor/composables/useLiveValidation.ts` (200 ms debounce on every doc mutation, deep watch, runs `validate()` and writes back). Mounted once at App level.
- `src/editor/components/ValidationPanel.vue`: diagnostic list grouped by severity, click-to-jump selects the offending node or edge.
- Search-driven palette: substring filter on type / display_name / category, hides empty groups, empty-state message.
- Auto-layout: `src/editor/autoLayout.ts` runs Dagre (LR rankdir) and returns a `Map<id, Position>`; `src/editor/composables/useAutoLayout.ts` wraps the write-back as a single Tidy transaction; TopBar Tidy button.
- Keyboard shortcuts (`src/editor/composables/useShortcuts.ts`): Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y for undo/redo; Ctrl/Cmd+C / X / V for clipboard; Delete / Backspace for remove selection. Skips when focus is in an editable element.
- TopBar gains Undo / Redo (with disabled-state binding) and Tidy buttons.
- App.vue grid extended with a centre column that stacks the canvas above the validation panel.
- New dev dep: `@dagrejs/dagre`.
- Tests: 4 new Vitest files / 22 new cases - historyStore (10), clipboardStore (6), validationStore (2), useLiveValidation under happy-dom with fake timers (2), autoLayout (2). Total: 29 Vitest files / 189 cases. 2 new Playwright e2e cases - undo/redo round-trip on a Constant; ISOLATED_NODE warning surfaces for a fresh Constant.

### Phase 2 — Minimal Visual Editor (complete, 2026-05-01, tag `phase-2-complete`)
- Vue 3 + Vite + Pinia + Element Plus scaffold (`src/main.ts`, `src/App.vue`, `vite.config.ts`, `index.html`, ambient `src/shims-vue.d.ts`).
- Pinia stores: `useDocumentStore` wraps the `GraphDocument` with addNode / removeNode (cascade-prunes incident edges) / moveNode / renameNode / updateParameter / setFrequency / addEdge (deterministic id) / removeEdge / setViewport / replaceDocument / newDocument; `useEditorStore` tracks selection (node + edge sets, additive or replace), viewport, and dirty flag.
- `src/editor/canConnect.ts`: pre-add port-validity gate mirroring `src/validator/rules/ports.ts` post-add diagnostics.
- `src/editor/composables/useCanvasOperations.ts`: bridge layer between canvas events and the stores; flips dirty on every mutation, runs `canConnect` before edge add, applies registry parameter defaults to new nodes, exposes `removeSelected`.
- `src/editor/composables/useFileIO.ts`: save() builds a Blob and triggers a download via a transient anchor; open(File) parses JSON, dispatches via `serializer/index.loadGraph` (auto-detects legacy vs versioned), re-parses through `GraphDocumentSchema`, replaces the document, clears selection, marks clean.
- Components: `CustomNode.vue` (registry-driven typed handles), `CanvasView.vue` (VueFlow with Background / MiniMap / Controls; node-id `number<->string` translation), `Palette.vue` (registry-grouped click-to-add), `PropertyPanel.vue` (edits name and Constant.value for the single-selected node), `TopBar.vue` (New / Open / Save / Save As + dirty indicator + error display).
- ESLint: added `eslint-plugin-vue` flat/recommended config, browser globals for `.ts` and `.vue`, layout rules disabled in favour of Prettier, `vue/multi-word-component-names` disabled.
- Tests: 3 Vitest files added (15 cases) — documentStore (13), editorStore (8), canConnect (6), useCanvasOperations (6), useFileIO under happy-dom (3 round-trip + negative cases). Total Vitest: 24 files / 168 tests.
- `tests/e2e/editor.spec.ts` + `playwright.config.ts`: 3 Playwright cases — shell renders, palette adds + property panel reflects + dirty indicator, Save triggers a download whose contents parse as GraphDocument v1.
- CI: `pnpm build` + Playwright browser install + `pnpm e2e` added to `.github/workflows/ci.yml` after the Vitest step.

### Phase 1 — Schema & Runtime Adapter (complete, 2026-05-01, tag `phase-1-complete`)
- Scaffolded the project: TypeScript strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`, ESLint flat config with `typescript-eslint` projectService, Prettier, Vitest 4, pnpm 10.33.2 via corepack, Node 22.
- `src/document/`: `GraphDocument` / `GraphNode` / `GraphEdge` / `Viewport` Zod schemas and inferred TS types; deterministic node-id and edge-id allocators (`nextNodeId`, `edgeIdFor`).
- `src/registry/`: `NodeTypeDescription` schema, built-ins for `Constant` / `Add` / `Print`, and a registry with `get(type)` / `all()` plus a default singleton.
- `src/serializer/`: read-only legacy loader (synthesises positions and edge ids), versioned load/save round-trip, and an auto-detect dispatch entry point.
- `src/validator/`: machine-readable `CODES`, `Diagnostic` schema/type with `error()` / `warning()` helpers, seven rule files (`ids`, `edges`, `ports`, `params`, `freq`, `cycles`, `warnings`) covering 15 of 16 codes, and a `validate(doc, registry?)` orchestrator returning `Diagnostic[]` ordered errors-before-warnings. `CODES.FREQUENCY_FOR_MISSING_NODE` reserved-but-deferred (current schema makes it unreachable).
- `src/compiler/compile.ts`: `GraphDocument` → legacy-shaped runtime JSON plus optional per-node `frequency_hz`; strips editor-only state (positions, viewport, edge.id); throws on Constant invariant violations.
- Fixtures: `fixtures/legacy/simple-add.json` and `fixtures/legacy/parallel-add.json` verbatim from the prompt; `fixtures/versioned/simple-add.json` matches the legacy-loader output exactly.
- Tests: 19 Vitest files / 132 cases covering every editor-side "Suggested Validation Test" from the prompt, full legacy → versioned round-trip on the fixture, save/load round-trip, and end-to-end validator + compiler integration through both fixtures.
- CI: `.github/workflows/ci.yml` runs lint, typecheck, format check, and tests on push/PR (Node 22 + corepack pnpm). Build step deferred to Phase 2.
- All four local gates green at HEAD: `pnpm test/lint/typecheck/format:check` exit 0.

### Phase 0 — Analysis & Decision (complete, 2026-05-01)
- Brainstormed and locked stack, scope, and architecture.
- Wrote design spec at `docs/specs/2026-05-01-n8n-port-editor-design.md`.
- Wrote `PROJECT_MEMORY.md` and `PLAN.md`.
- Wrote ADRs 0001–0006 covering editor-only posture, Vue+VueFlow stack, Zod, command-pattern undo, persistence, Phase-4 reinterpretation.
- Wrote README skeleton.
- Initialised git repository.
