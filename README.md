# n8n-port

A web-based graph editor for an external C++ DAG runtime, adapted from n8n's editor patterns. The runtime is **not** in this repository — see `docs/decisions/0001-editor-only-no-cpp-runtime.md`.

## Status

**Phases 0–4 complete** (tags `phase-1-complete`…`phase-4-complete` on `master`). See `PLAN.md` Backlog for unscoped follow-ups and `PROJECT_MEMORY.md` for architecture state.

## Stack

Vue 3 · Vue Flow · Pinia · Vite · Element Plus · Vitest · Playwright · TypeScript strict · Zod. Same as n8n's `editor-ui` plus Zod for runtime JSON validation.

## Build / run / test

> Phase 1 onward. The repository is currently docs-only.

Prerequisites once Phase 1 begins: Node 22 LTS, pnpm via corepack.

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
pnpm e2e            # playwright

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
the binary is also reachable as `vizgraph` via the `bin` shim.

## Repository layout

```
.
├── N8N_GRAPH_EDITOR_ADAPTATION_PROMPT.md   prompt (source of truth for runtime semantics)
├── PROJECT_MEMORY.md                        durable cross-session memory
├── PLAN.md                                  active checklist
├── CHANGELOG.md                             per-phase summary
├── docs/
│   ├── specs/                               immutable design specs
│   └── decisions/                           ADRs
└── (src/, tests/, fixtures/ … created in Phase 1)
```

## Reading order for new contributors

1. `PROJECT_MEMORY.md`
2. `PLAN.md`
3. `docs/specs/2026-05-01-n8n-port-editor-design.md`
4. ADRs as needed
5. Source

## License

TBD (will be set before any external publication). n8n is referenced only as inspiration; no n8n source files are vendored. See ADR-0001 for the editor-only posture.
