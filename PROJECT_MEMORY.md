# PROJECT_MEMORY — n8n-port

> Durable cross-session memory. Read this first every session before any architecture-sensitive, multi-file, implementation, refactoring, debugging, or planning task.

## What this project is

A Vue 3 web editor that produces a versioned JSON graph document for an **external** C++ DAG runtime. The C++ runtime is described in `N8N_GRAPH_EDITOR_ADAPTATION_PROMPT.md` but is **not** in this repository. We do not implement, stub, or import C++ here.

The editor is informed by n8n's editor-ui (Vue 3 + Vue Flow + Pinia + Vite + Element Plus). Patterns are adapted, code is not copied. License posture: n8n source is reference material only; no n8n source files are imported or vendored. If that ever changes, document the license review first.

## Current phase

**Phase 4 — Run-Result Import & Observability complete** (tag `phase-4-complete` on `phase-4-runresult`; 31 Vitest files / 202 tests + 6 Playwright e2e cases all green). All four committed phases complete.

**Backlog progress (2026-05-02, all merged to `master` and pushed to `origin`):** ✅ Headless CLI · ✅ Plugin / external node-type registration · ✅ Code-splitting + Element Plus eager-load removed (initial gzip 417 KB → ~17 KB) · ✅ Ctrl+S / Ctrl+O / F shortcuts · ✅ Comments / annotations.

**Resumption point — pick one of two remaining backlog items** (full detail in `CHANGELOG.md`):
1. **Theming (n8n-style dark theme + a11y audit)** — recommended next: lower architectural risk, broader polish. Introduces `useTheme` composable, swaps hard-coded colors to CSS variables with light/dark sets, axe pass via Playwright. Element Plus is still in `package.json` but unused at runtime — its CSS variable fallbacks are intentional and should keep working.
2. **Sub-graphs / grouping** — biggest remaining architectural change: touches schema, validator, compiler, canvas. Save for last.

Repo HEAD is `master` at `f0d0ee8` with all four phase tags + 5 backlog commits pushed. Working tree clean. `pnpm test/lint/typecheck/format:check/build/e2e` all exit 0.

## Tech stack (locked Phase 0)

| Layer | Choice |
|---|---|
| Language | TypeScript strict, `noUncheckedIndexedAccess` |
| Framework | Vue 3 (Composition API, `<script setup>`) |
| Canvas | `@vue-flow/core` + `background`, `controls`, `minimap`, `node-resizer` |
| State | Pinia |
| UI kit | Element Plus |
| Build | Vite |
| Tests | Vitest + happy-dom + @vue/test-utils |
| E2E | Playwright |
| Lint/format | ESLint (eslint-plugin-vue) + Prettier |
| Pre-commit | husky + lint-staged |
| Auto-layout | @dagrejs/dagre |
| Palette DnD | vuedraggable |
| Icons | lucide-vue-next |
| Runtime JSON validation | **Zod** (deviation from n8n; required by structured-diagnostic contract) |
| Package manager | pnpm (via corepack) |
| Node target | 22 LTS |
| Repo layout | single package at root |

## Module map

```
src/
  document/   GraphDocument types and helpers (pure data)
  registry/   NodeTypeRegistry + built-in NodeTypeDescriptions
  serializer/ legacy + versioned JSON loader/saver
  validator/  GraphDocument -> Diagnostic[]
  compiler/   GraphDocument -> runtime-bound JSON
  editor/
    components/   Canvas, Palette, PropertyPanel, ValidationPanel, TopBar, ...
    stores/       documentStore, editorStore, historyStore, clipboardStore,
                  validationStore, executionStore
    composables/  useCanvasOperations, useUndo, useShortcuts, useClipboard,
                  useAutosave
tests/
  unit/       per-module Vitest
  e2e/        Playwright flows
fixtures/     legacy + versioned + run-result samples
docs/
  specs/      design specs (immutable records of decisions in force)
  decisions/  ADRs
```

Pure functions in `document`, `registry`, `serializer`, `validator`, `compiler` — no Vue or store imports.

## Core contracts (summary; full schemas in `docs/specs/`)

- **`GraphDocument`**: `{version:1, graph:{nodes, edges, viewport}}`. Editor-only fields (position, viewport, edge ids) live here, never on the runtime side.
- **`NodeTypeDescription`**: drives palette, ports, property panel, and validator. Built-ins: `Constant`, `Add`, `Print` (port shapes per the prompt).
- **`Diagnostic`**: `{severity, code, message, node_id?, edge_id?, field?}`.
- **`RunResult`** (Phase 4): single-tick first; multi-tick later.
- **Legacy JSON**: detected by top-level `nodes`/`edges` without `version`; read-only. Saving always emits versioned.

## Conventions

- Conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`).
- One Zod schema per data type, exported alongside its TS type.
- All validator rules emit machine-readable `code` strings (e.g., `"invalid_target_port"`); messages are human-readable but the code is the API.
- No comments unless explaining a non-obvious *why*.
- Files stay focused; if one grows past ~250 lines, consider splitting.
- Tests colocated under `tests/unit/<module>` mirroring `src/<module>` paths.

## Decision log (full ADRs in `docs/decisions/`)

- ADR-0001 — Editor-only, no in-repo C++ runtime.
- ADR-0002 — Vue 3 + Vue Flow stack (n8n parity).
- ADR-0003 — Zod for runtime validation.
- ADR-0004 — Command-pattern undo/redo.
- ADR-0005 — Persistence: browser download + `<input type=file>` + localStorage autosave + File System Access API as Chromium progressive enhancement.
- ADR-0006 — Phase-4 reinterpreted as RunResult import.

## Environment notes (Phase 0 snapshot)

- User dev machine: Node v18.20.8 (must upgrade to 22 LTS before Phase 1 install).
- pnpm not installed; corepack present at `/home/fom/.nvm/versions/node/v18.20.8/bin/corepack`. Use `corepack enable && corepack use pnpm@latest-10` in Phase 1.
- git available.
- No CI yet.

## Environment notes (Phase 1 / Plan Task 1 — toolchain verified 2026-05-01)

- Node v22.22.2 active via nvm; default alias is `22`. Bash subshells **do not** auto-source nvm — every Node/pnpm command in a non-login shell needs `. ~/.nvm/nvm.sh && nvm use 22 >/dev/null && …` as a prefix.
- pnpm 10.33.2 active via corepack; corepack required a fully-qualified semver in `package.json` `packageManager` (`pnpm@10` was rejected, `pnpm@10.33.2` accepted).
- Resolved versions in `pnpm-lock.yaml`: zod 4.4.1, vitest 4.1.5, typescript 6.0.3, eslint 10.2.1, typescript-eslint 8.59.1, @vitest/coverage-v8 4.1.5, @eslint/js 10.0.1. Notable transitive: `rolldown@1.0.0-rc.17` (RC; pulled by Vitest 4 — flag for the Phase-2 Vite build but not currently exercised).
- ESLint uses flat config (`eslint.config.js`) with the `typescript-eslint` meta package and `projectService: true`. Empty `src/` does not break `pnpm lint`.
- Prettier scripts use `--no-error-on-unmatched-pattern` so an empty `src/` does not break `pnpm format:check`.
- All four `pnpm` verifications (test/lint/format:check/typecheck) exit 0 at HEAD of the feature branch.
- No CI yet (Plan Task 22 will add it).
- TS-type assertion gotcha: `tsconfig.json#include` only covers `src/**/*`, `tests/**/*`, and `vitest.config.ts`. Any throwaway probe file used to verify a type narrows correctly **must** live inside `src/` or `tests/`; a probe at the repo root is silently ignored by `tsc` and produces a false-positive "passes" signal.

## Environment notes (Phase 2 — toolchain extended 2026-05-01)

- Runtime stack added: vue 3.5.33, pinia 3.0.4, element-plus 2.13.7, lucide-vue-next 1.0.0, @vue-flow/{core,background,controls,minimap,node-resizer} 1.x.
- Dev tooling added: vite 8.0.10 (rolldown), @vitejs/plugin-vue 6.0.6, vue-tsc 3.2.7, @vue/test-utils 2.4.10, happy-dom 20.9.0, @playwright/test, eslint-plugin-vue 10.9.0, vue-eslint-parser 10.4.0.
- `package.json` scripts: `dev` (vite), `build` (`vue-tsc -b && vite build`), `preview`, `e2e` (playwright test), `e2e:ui`. `typecheck` switched from `tsc --noEmit` to `vue-tsc --noEmit` to handle `.vue` SFCs.
- `tsconfig.json`: `lib` extended with `DOM`, `DOM.Iterable`; `jsx: "preserve"`; `types += vite/client`; `include` extended with `src/**/*.vue` and `vite.config.ts`. `*.tsbuildinfo` is gitignored; vue-tsc's `-b` flag produces it during `pnpm build`.
- ESLint .vue branch uses `vue-eslint-parser` with `parser: tseslint.parser` for `<script lang="ts">`. Layout rules (`singleline-html-element-content-newline`, `multiline-html-element-content-newline`, `max-attributes-per-line`, `html-self-closing`, `html-closing-bracket-newline`, `first-attribute-linebreak`, `html-indent`) are off so Prettier owns formatting; `vue/multi-word-component-names` is off because `Palette` / `TopBar` do not collide with native HTML elements.
- Drag-to-connect through VueFlow handles is empirically fragile via Playwright mouse events; the e2e cases stay smoke-level and the full build-and-round-trip lives in a happy-dom Vitest case using `useCanvasOperations.connect()` directly.
- Production bundle is a single ~1.25 MB chunk (Element Plus + VueFlow eager-loaded). Code-splitting is a Phase-3 task; the Vite warning is expected for now.
- Playwright browsers: only chromium installed (`pnpm exec playwright install chromium`). CI installs with `--with-deps`.

## Environment notes (Phase 3 — toolchain extended 2026-05-01)

- Runtime stack added: `@dagrejs/dagre` for auto-layout (LR rankdir, sensible nodesep/ranksep). The dagre call in `src/editor/autoLayout.ts` carries one targeted `eslint-disable @typescript-eslint/no-unsafe-argument` because dagre's typed `layout(g)` expects a fully-parameterised graph; constructing it for our minimal label needs is awkward and the call is type-safe in practice.
- ADR-0004 implementation: undo/redo uses a snapshot/memento variant rather than per-command apply/undo classes. JSON snapshots are deep-cloned cheaply and avoid Vue-reactivity hazards from sharing object references across stacks. MAX_DEPTH = 100. The plain "Command" pattern remains compatible with this layer (no future migration cost) but the snapshot variant wins on simplicity for the present rule set.
- Live validation watches `documentStore.doc` deeply with a 200 ms debounce; each mutation cancels the pending tick and reschedules. Mounted once at App level; tests use `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync` to verify the debounce window.
- Keyboard shortcuts: registered on `window` keydown with cleanup on unmount. Skips when focus is in `INPUT`/`TEXTAREA`/`SELECT` or `contentEditable`. Ctrl+S / Ctrl+O / F deferred — they conflict with browser defaults and the on-screen TopBar buttons + VueFlow Controls cover the same actions.

## Contributor identity

All commits in this project use the **morinf-TUM** identity (configured project-locally — not globally). Any agent or session must verify `git config user.name` / `git config user.email` resolve to morinf-TUM before committing. Existing pre-rule commits under another local-machine identity remain as-is and must not be rewritten.

## Open questions

Carried in `docs/specs/2026-05-01-n8n-port-editor-design.md` §17. None block Phase 1.

## How to read this project

1. Read this file.
2. Read `PLAN.md` for the next concrete task.
3. Read `docs/specs/2026-05-01-n8n-port-editor-design.md` only when architecture-level context is needed.
4. Read individual ADRs only when revisiting a settled decision.
5. Source files in `src/` are the truth; if anything here contradicts the source, prefer the source and fix this file.

## Update protocol

End of every session, update:
- This file's **Current phase** line.
- This file's **Environment notes** if anything material changed.
- `PLAN.md` checkboxes.
- `CHANGELOG.md` if a phase or sub-milestone completed.

Do not rewrite, compress, or summarise pre-existing sections; only append or surgically correct contradictions.
