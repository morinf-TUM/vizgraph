# vizgraph

A web-based graph editor for an external C++ DAG runtime, with UX patterns inspired by n8n's editor. The runtime is **not** in this repository — see `docs/decisions/0001-editor-only-no-cpp-runtime.md`.

## Status

**Phases 0–4 complete** (tags `phase-1-complete`…`phase-4-complete` on
`master`) plus the post-Phase-4 backlog: headless CLI (`vizgraph` binary),
plugin / external node-type registration, code-splitting (initial gzip
417 KB → ~17 KB), Ctrl+S / Ctrl+O / F shortcuts, free-floating and
anchored comments, drag-to-add palette, n8n-style dark theme + axe a11y
gate, and sub-graphs / grouping (recursive encapsulation, drill-in,
flatten-at-compile — see ADR-0007). Tag `subgraphs-complete` marks the
sub-graphs landing.

Gates: 47 Vitest files / 297 cases + 12 Playwright cases + axe a11y
regression check, all green. `pnpm test/lint/typecheck/format:check/build/e2e`
all exit 0.

See `PROJECT_MEMORY.md` for the canonical architecture state, `PLAN.md`
for the per-phase + backlog checklist, `CHANGELOG.md` for per-milestone
detail, and `SMOKE_TEST.md` for a human end-to-end walkthrough.

## Features

- Versioned `GraphDocument` JSON (legacy fixtures load read-only;
  saving always emits versioned).
- Built-in node types: `Constant`, `Add`, `Print`. Third-party types
  register through the registry (see below).
- Canvas: drag, connect, click + drag-to-add from palette, copy/paste,
  delete, fit-view, lock/unlock, minimap.
- PropertyPanel: edit `Constant.value`, node `name`, sub-graph pseudo-port
  `name` / `portType`, plus a "+ comment attached to this node" affordance.
- Comments: free-floating notes via the top bar, or anchored to a node
  (anchored comments follow the node on move and auto-detach when the
  node is removed).
- Sub-graphs: select nodes → `Group` → drill in via double-click on the
  Subgraph node → edit pseudo-ports → drill out via breadcrumbs. Compile
  flattens recursively to the existing runtime-bound JSON shape.
- Live debounced validation (200 ms) with a structured `Diagnostic[]`
  exposed in the panel and via the CLI; click-to-jump on each row.
- Run-result import + Inspect mode with single-tick and multi-tick
  browsing.
- Undo/redo (snapshot variant of ADR-0004), Tidy / auto-layout (Dagre),
  Save / Open (browser download + file picker, plus localStorage
  autosave and File System Access API as a Chromium progressive
  enhancement).
- Keyboard: Ctrl+Z/Y, Ctrl+C/V/X, Delete, Ctrl+S, Ctrl+O, F.
- Dark theme with primitive + semantic two-layer tokens
  (`src/styles/theme.css`, contract in `docs/theming.md`); axe a11y
  regression gate at `wcag2a/aa` + `wcag21a/aa`.
- Headless CLI (`vizgraph`) for validate / compile / round-trip — same
  rules as the in-editor validator, suitable for CI.

## Stack

Vue 3 · Vue Flow · Pinia · Vite · Element Plus · Vitest · Playwright ·
TypeScript strict · Zod. Same as n8n's `editor-ui` plus Zod for runtime
JSON validation. Auto-layout via `@dagrejs/dagre`, icons via
`lucide-vue-next`.

## Build / run / test

Prerequisites: Node 22 LTS, pnpm via corepack.

```bash
# one-time setup (after Node 22 is on PATH)
corepack enable
corepack use pnpm@latest-10

# install
pnpm install

# dev server
pnpm dev

# checks
pnpm lint
pnpm typecheck
pnpm test           # vitest --run
pnpm test:watch
pnpm e2e            # playwright (chromium)

# production build
pnpm build
pnpm preview

# headless CLI (validator + compiler + roundtrip)
pnpm cli validate fixtures/legacy/simple-add.json
pnpm cli compile  fixtures/legacy/simple-add.json --out runtime.json
pnpm cli roundtrip fixtures/legacy/simple-add.json --pretty
```

The CLI accepts both legacy and versioned graph JSON. Exit codes: `0`
success, `1` validation/compile errors, `2` bad invocation. `validate
--json` emits the `Diagnostic[]` machine-readable. After `pnpm install`,
the binary is also reachable as `vizgraph` via the `bin` shim
(`bin/vizgraph.mjs`).

For end-to-end manual verification across every shipped feature, follow
`SMOKE_TEST.md`.

## Plugin / external node types

Third-party node types register against the default registry at app boot,
before `createApp(...).mount(...)`:

```ts
import { defaultRegistry } from "./registry/registry";

defaultRegistry().register({
  type: "Counter",
  display_name: "Counter",
  category: "Plugin",
  inputs: [{ name: "tick", type: "int" }],
  outputs: [{ name: "count", type: "int" }],
  parameters: { start: { type: "int", required: false, default: 0 } },
});
```

Registration re-parses through `NodeTypeDescriptionSchema`, so any
schema-invalid input is rejected before the registry is mutated.
Re-registering an existing type throws unless `{ replace: true }` is
passed. `unregister(type)` removes a type. Reactivity for hot-add at
runtime is deferred — register before mount.

## Repository layout

```
.
├── N8N_GRAPH_EDITOR_ADAPTATION_PROMPT.md   prompt (source of truth for runtime semantics)
├── PROJECT_MEMORY.md                        durable cross-session memory
├── PLAN.md                                  active checklist (phases + backlog)
├── CHANGELOG.md                             per-phase + per-milestone summary
├── SMOKE_TEST.md                            human end-to-end walkthrough
├── LICENSE                                  Apache-2.0
├── bin/
│   └── vizgraph.mjs                         CLI shim
├── docs/
│   ├── specs/                               immutable design specs
│   ├── decisions/                           ADRs (0001-0007)
│   └── theming.md                           semantic-token contract
├── fixtures/
│   ├── legacy/                              legacy-format sample graphs
│   ├── versioned/                           versioned-format sample graphs
│   └── run-results/                         RunResult sample payloads
├── src/
│   ├── document/                            GraphDocument types, schemas, helpers (pure data)
│   ├── registry/                            NodeTypeRegistry + built-ins (Constant, Add, Print)
│   ├── serializer/                          legacy + versioned loader/saver
│   ├── validator/                           GraphDocument → Diagnostic[]
│   ├── compiler/                            GraphDocument → runtime-bound JSON
│   ├── cli/                                 vizgraph CLI implementation
│   ├── styles/                              theme tokens (primitive + semantic)
│   └── editor/                              Vue components, Pinia stores, composables
└── tests/
    ├── unit/                                Vitest, mirroring src/
    └── e2e/                                 Playwright (editor.spec.ts, subgraph.spec.ts, a11y.spec.ts)
```

## Reading order for new contributors

1. `PROJECT_MEMORY.md`
2. `PLAN.md`
3. `docs/specs/2026-05-01-n8n-port-editor-design.md`
4. ADRs as needed (`docs/decisions/0001`…`0007`)
5. `SMOKE_TEST.md` for the human-visible feature set
6. Source

## License

Licensed under the Apache License, Version 2.0. See [`LICENSE`](LICENSE) for
the full text.

This project is an independent reimplementation: no n8n source code is
copied or vendored — only the editor's UX patterns and conventions are
referenced as design inspiration, with attribution in `docs/specs/` and
`docs/decisions/`. "n8n" is a trademark of n8n GmbH; this project is not
affiliated with or endorsed by n8n GmbH.


