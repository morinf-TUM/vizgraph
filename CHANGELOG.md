# Changelog

All notable changes are recorded here at every phase boundary or significant milestone.

## [Unreleased]

### Backlog: dark theme + a11y audit (2026-05-02)
- Single n8n-style dark palette in `src/styles/theme.css`, structured as a **primitive layer** (`--vg-color-*`, raw values, never consumed by components) and a **semantic layer** (`--vg-*`, what components read). Components consume only semantic tokens; reaching for a primitive is a smell.
- Selector `[data-theme="dark"], :root` future-proofs the toggle: a sibling `[data-theme="light"] { … }` block adds a light theme with zero component changes. `<html data-theme="dark">` is set in `index.html`; no runtime toggle, no `useTheme` composable, no `prefers-color-scheme` (out-of-scope per design).
- New `docs/theming.md` is the semantic-token contract for contributors — every token's intended use, plus the rule that any new use case adds a new semantic token rather than reaching into primitives.
- 7 Vue components swept: `App.vue`, `TopBar.vue`, `Palette.vue`, `PropertyPanel.vue`, `ValidationPanel.vue`, `CustomNode.vue`, `CommentNode.vue`. `CanvasView.vue` had no color rules to sweep. Element Plus `var(--el-*-, #fallback)` patterns kept their `--el-*` reference; only the fallback hex was retargeted to a `var(--vg-*)` semantic token. A small set of root-wrapper rules gained explicit `color`/`background` declarations where the original light-theme stylesheet relied on browser-default black-on-white inheritance.
- New e2e gate `tests/e2e/a11y.spec.ts` runs `@axe-core/playwright` against the editor at `wcag2a/aa` + `wcag21a/aa`, asserting zero `serious`/`critical` violations. Fixed one pre-existing a11y bug surfaced during baseline calibration: VueFlow Controls buttons were unlabeled — replaced with the package's named-slot API (`#control-zoom-in`, `#control-zoom-out`, `#control-fit-view`, `#control-interactive`), each rendering a `ControlButton` with an `aria-label` and a lucide icon. The slot approach removes a runtime DOM mutation and keeps the labels declarative.
- Dev-dep added: `@axe-core/playwright`.
- Total gates: 33 Vitest files / 240 cases + 9 Playwright cases (including the new a11y gate). lint / typecheck / format / build all green.

### Backlog: comments / annotations on the canvas (2026-05-02)
- New `Comment` Zod schema and inferred TS type in `src/document/types.ts` (`{ id, text, position, size?, color? }`); `GraphSchema.comments` is `z.array(CommentSchema).default([])` so existing v1 documents without comments still parse — no schema-version bump.
- `documentStore` mutators: `addComment`, `removeComment`, `moveComment`, `updateComment`. `useCanvasOperations` adds `addCommentAt`, `removeComment`, `moveComment`, `editCommentText`, all wrapped in `history.transact` so Ctrl+Z reverts a single user action atomically.
- `nextCommentId` allocates short `c<n>` ids by scanning the live array's max — deleted ids are reissued (intentional: comment ids aren't user-facing references and skipping a monotonic counter avoids a schema field).
- `CommentNode.vue` renders the comment with a dashed amber border, inline double-click-to-edit textarea, Esc cancels, Ctrl/Cmd+Enter commits, blur commits. Watcher syncs the local draft with store updates from undo/redo while not in edit mode.
- `CanvasView.vue` integrates comments by mapping `docStore.comments` to VueFlow nodes with `type: "comment"` and a `c:` id prefix that the change handlers strip back off. Comments don't participate in editor-store selection (no property-panel hook) but do support drag and remove via the existing VueFlow change events.
- `compile()` already drops comments (it reads only `nodes` and `edges`); a new test pins this — runtime JSON is still legacy-shaped, no `comment` strings leak through.
- TopBar gains a `Comment` button next to `Tidy`.
- Tests: 5 new vitest cases for comment ops + 1 compiler-strips-comments case + 1 Playwright case (add comment via the button, see `.vue-flow__node-comment`, save and verify the comment round-trips through the JSON download). Schema-cascading touch-ups: 6 existing tests + the legacy serializer add `comments: []` to their explicit `GraphDocument` literals; the on-disk `fixtures/versioned/simple-add.json` adds an empty comments array. Total: 33 vitest files / 240 cases + 8 Playwright cases. lint / typecheck / build / format all green.

### Backlog: Ctrl+S / Ctrl+O / F keyboard shortcuts (2026-05-02)
- `useShortcuts.ts` extended with `Ctrl/Cmd+S` (save current document via `useFileIO.save("graph.json")`), `Ctrl/Cmd+O` (programmatic file picker via the new `src/editor/openFile.ts` helper, then `useFileIO.open(file)`), and `F` (fit-view, dispatched through the editor store).
- `editorStore` gains `fitViewFn: Ref<(() => void) | undefined>`, `setFitViewFn(fn)`, and `fitView(): boolean`. `CanvasView` registers `useVueFlow().fitView` on mount and clears the slot on unmount, so the global keyboard layer never holds a reference to a stale VueFlow instance.
- `src/editor/openFile.ts`: pops a transient hidden `<input type="file">` and resolves with the picked `File` (or `undefined` on cancel). Works in every browser and decouples Ctrl+O from the TopBar's file input.
- Editable-target skip rule (already in place for the existing shortcuts) covers the new keys too — typing in the property panel or palette search isn't intercepted.
- Tests: 10 new Vitest cases in `useShortcuts.test.ts` cover Ctrl+Z/Y/Shift+Z/C/V/Delete plus the three new keys (S spies on `URL.createObjectURL` + the anchor `click` to confirm the download path; F asserts the registered fit-view is invoked and no-ops gracefully when unregistered; the editable-target skip rule is exercised against a real focused `<input>`). 1 new Playwright case asserts `Control+S` triggers a real browser download with `graph.json` filename. Total: 33 Vitest files / 235 cases + 7 Playwright cases.

### Backlog: code-splitting + Element Plus eager-load removal (2026-05-02)
- Initial-bundle gzip dropped from **417 KB → ~17 KB** (the editor shell — TopBar / Palette / PropertyPanel / ValidationPanel + Vue + Pinia). Total bundle from 1,306 KB → ~438 KB across 6 chunks.
- `src/main.ts` no longer eager-imports Element Plus. The dep stays in `package.json` (locked stack), but the global `app.use(ElementPlus)` and `element-plus/dist/index.css` import were ~700 KB of unused weight — no component or directive in the editor uses Element Plus, only its CSS variables (which already had native fallbacks). Future components that need Element Plus can import per-component (`import { ElButton } from "element-plus"`).
- `src/App.vue`: `CanvasView` is now a `defineAsyncComponent` so the shell paints immediately while VueFlow + the @vue-flow companions load in the background. Loading state is a small `data-testid="canvas-loading"` placeholder.
- `vite.config.ts`: `build.rolldownOptions.output.codeSplitting.groups` declarative vendor splits — `vendor-vue` (vue + pinia + @vue/runtime-*), `vendor-vueflow`, `vendor-graph` (dagre), `vendor-zod`. Each chunk caches independently across editor builds.
- 225 Vitest cases + 6 Playwright e2e cases all green; lint / typecheck / format clean.

### Backlog: plugin / external node-type registration API (2026-05-02)
- `NodeTypeRegistry` interface gains `register(description, { replace? })`, `unregister(type)`, and `has(type)`. Registration re-parses through `NodeTypeDescriptionSchema` so plugin authors get the same Zod diagnostics the loader path produces. Re-registering an existing type throws by default; pass `{ replace: true }` to override (silent shadowing is intentionally not allowed).
- `defaultRegistry()` is the canonical plugin host: a third-party plugin imports the singleton, calls `register(...)` for each type it provides at app boot before mount, and the rest of the editor (`Palette`, `CustomNode`, `validator/rules/ports`, `params`, `useCanvasOperations`) sees the new types unchanged. Reactivity for hot-add at runtime is deferred — pre-mount registration is the supported pattern for v1.
- Tests: 8 new Vitest cases covering `has`, `register` (add / duplicate-rejection / replace / schema-fail), `unregister` (success / unknown), and the default-registry plugin-host round-trip. Total: 32 Vitest files / 225 cases.

### Backlog: headless CLI (2026-05-02)
- `src/cli/index.ts`: `validate` / `compile` / `roundtrip` subcommands plus `help`. Loads either legacy or versioned JSON via the existing `serializer/index.loadGraph` dispatch. Exit codes 0 / 1 / 2 (success / errors found / bad invocation). `validate --json` emits the `Diagnostic[]` machine-readable; `validate --warnings-as-errors` upgrades warnings; `compile [--out path] [--pretty]` writes runtime-bound JSON; `roundtrip [--pretty]` canonicalises legacy → versioned.
- `bin/vizgraph.mjs`: shim that re-exec's the TS entry through `tsx`, so `pnpm install` exposes a `vizgraph` binary without a separate build step. `pnpm cli ...` is the dev-time equivalent.
- New devDep: `tsx`.
- Tests: 1 new Vitest file / 15 cases covering help, unknown command, validate (clean / missing file / bad JSON / schema-fail / errors found / `--json` / `--warnings-as-errors`), compile (stdout / `--out` / abort-on-validation-errors / missing `--out` arg), roundtrip. Total: 32 Vitest files / 217 cases.
- ESLint: ignore `bin/**` (the `.mjs` shim is not in the TS project, so type-aware rules can't lint it).
- README: surfaced the CLI commands and exit-code contract.

### Phase 4 — Run-Result Import & Observability (complete, 2026-05-01, tag `phase-4-complete`)
- `src/document/runresult.ts`: `RunResultSchema` / `RunResultTickSchema` / `RunResultNodeSchema` and inferred TS types matching spec section 6.4. version literal 1, graph_id nullable, ticks min(1), per-node outputs as record<string, unknown>, duration_ns nonnegative, error nullable string.
- `src/editor/stores/executionStore.ts`: holds the imported `RunResult`, current `tickIndex`, `mode` ("edit" | "inspect"), with computed `ticks` / `tickCount` / `currentTick` / `overlayByNodeId`. `setResult` flips mode to inspect and resets tickIndex; `clearResult` resets mode and tick state; `setTickIndex` is bounds-checked; `toggleMode` flips edit/inspect.
- `src/editor/composables/useRunResultImport.ts`: file -> JSON -> `RunResultSchema.safeParse` -> `executionStore.setResult`, with error paths for read / parse / schema failures.
- `src/editor/components/CustomNode.vue`: in inspect mode, renders per-output-port values from the overlay map next to each handle; shows duration in the footer or the runtime error string when present (errored nodes get a red border).
- `src/editor/components/TopBar.vue`: edit/inspect mode badge, Import RunResult / Inspect-mode toggle / Clear run buttons, and optional tick navigation (◀ / tick i / N ▶) when `tickCount > 1`. Hidden second file input for the run-result picker.
- `useFileIO.open()` also clears any active run result so stale overlays don't carry across graph swaps.
- Fixture: `fixtures/run-results/simple-add.json` (single tick, sum=5, durations populated).
- Tests: 2 new Vitest files / 13 cases — RunResultSchema (7 cases), executionStore (6 cases). 1 new Playwright case — load the simple-add document via the Open file input, import the run-result fixture, assert `overlay-3-sum` text "5", toggle back to edit mode, assert overlays disappear. Total: 31 Vitest files / 202 cases + 6 Playwright cases.

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
