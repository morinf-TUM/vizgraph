# Changelog

All notable changes are recorded here at every phase boundary or significant milestone.

## [Unreleased]

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
