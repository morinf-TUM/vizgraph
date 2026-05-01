# PROJECT_MEMORY — n8n-port

> Durable cross-session memory. Read this first every session before any architecture-sensitive, multi-file, implementation, refactoring, debugging, or planning task.

## What this project is

A Vue 3 web editor that produces a versioned JSON graph document for an **external** C++ DAG runtime. The C++ runtime is described in `N8N_GRAPH_EDITOR_ADAPTATION_PROMPT.md` but is **not** in this repository. We do not implement, stub, or import C++ here.

The editor is informed by n8n's editor-ui (Vue 3 + Vue Flow + Pinia + Vite + Element Plus). Patterns are adapted, code is not copied. License posture: n8n source is reference material only; no n8n source files are imported or vendored. If that ever changes, document the license review first.

## Current phase

**Phase 1 — Schema & Runtime Adapter complete** (tag `phase-1-complete` on `phase-1-schema-and-adapter`; 19 Vitest files / 132 tests green). Resumption point: **Phase 2 — Minimal Visual Editor**, starting from `src/main.ts` / `src/App.vue` and the Vite + Element Plus + lucide-vue-next entry.

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
