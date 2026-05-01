# Phase 1 — Schema & Runtime Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the non-UI core of the editor: a pure-data document model, node-type registry, JSON loader/saver (legacy + versioned), structured validator, and compiler. All "Suggested Validation Tests" from `N8N_GRAPH_EDITOR_ADAPTATION_PROMPT.md` and both sample graphs must pass.

**Architecture:** Pure TypeScript modules with zero Vue/store dependencies in this phase. One Zod schema per data type; TS types derive from schemas via `z.infer`. Validator returns `Diagnostic[]` from a pure function. Versioned + legacy JSON formats both round-trip through the same `GraphDocument`.

**Tech Stack:** TypeScript ~6.0 strict, Vitest ^4, Zod ^4, pnpm 10 via corepack, Node 22 LTS. ESLint ^10 (flat config) + typescript-eslint ^8.59 + Prettier ^3. GitHub Actions CI. (Versions and peer ranges verified 2026-05-01 against npm: zod 4.4.1, vitest 4.1.5, typescript 6.0.3, eslint 10.2.1, typescript-eslint 8.59.1 with peer range `typescript >=4.8.4 <6.1.0` — TypeScript pinned at `~6.0` to honor that ceiling; @eslint/js 10.0.1; @vitest/coverage-v8 4.1.5 — must match vitest exactly. Pin via lockfile after install.)

**Identity:** all commits in this project use the project-local git identity `morinf-TUM <45066770+morinf-TUM@users.noreply.github.com>`. Verify with `git config user.name && git config user.email` before any commit.

**Conventions:** conventional commits. One module per directory under `src/`. Zod schema and inferred TS type live in the same file. No comments unless explaining non-obvious *why*. Each commit leaves the tree green (`pnpm test` and `pnpm typecheck` succeed).

---

## Pre-requisites (manual, one-time)

These are user-driven. The plan does not commit until they're done. They must complete **once** at the start of Phase 1, then the rest is automated.

- [ ] **Step 0.1: Install Node 22 LTS.**
  Current dev Node is `v18.20.8`. Use nvm: `nvm install 22 && nvm use 22 && nvm alias default 22`. Verify: `node --version` → `v22.x.x`.

- [ ] **Step 0.2: Enable corepack and pin pnpm.**
  Run `corepack enable && corepack prepare pnpm@latest --activate`. Verify: `pnpm --version` → `10.x.x` or higher.

- [ ] **Step 0.3: Confirm git identity from inside the repo.**
  Run `git config user.name && git config user.email` from `/home/fom/code/n8n_port`. Expected:
  ```
  morinf-TUM
  45066770+morinf-TUM@users.noreply.github.com
  ```
  If not, stop and re-set per `PROJECT_MEMORY.md` *Contributor identity*.

---

## File map

```
package.json                                  Task 1
pnpm-lock.yaml                                Task 1 (generated)
.npmrc                                        Task 1
tsconfig.json                                 Task 1
vitest.config.ts                              Task 1
eslint.config.js                              Task 1
.prettierrc                                   Task 1
.gitignore                                    (already present, may extend in Task 1)

src/document/types.ts                         Task 3 — Zod schemas + inferred types
src/document/ids.ts                           Task 4 — node/edge ID allocators
src/document/index.ts                         Task 4 — barrel

src/registry/types.ts                         Task 5 — Zod schemas + types
src/registry/builtIns.ts                      Task 6 — Constant, Add, Print
src/registry/registry.ts                      Task 7 — registry implementation
src/registry/index.ts                         Task 7 — barrel

src/serializer/versioned.ts                   Task 8 — load + save
src/serializer/legacy.ts                      Task 9 — load (read-only)
src/serializer/index.ts                       Task 10 — auto-detect dispatch

src/validator/diagnostics.ts                  Task 2 — Diagnostic type, codes, helper
src/validator/codes.ts                        Task 2 — code string constants
src/validator/rules/duplicateNodeIds.ts       Task 11
src/validator/rules/unknownNodeType.ts        Task 12
src/validator/rules/parameters.ts             Task 13
src/validator/rules/edges.ts                  Task 14
src/validator/rules/ports.ts                  Task 15
src/validator/rules/frequency.ts              Task 16
src/validator/rules/cycles.ts                 Task 17
src/validator/rules/warnings.ts               Task 18
src/validator/validate.ts                     Task 19 — orchestrator
src/validator/index.ts                        Task 19 — barrel

src/compiler/compile.ts                       Task 20
src/compiler/index.ts                         Task 20 — barrel

fixtures/legacy/simple-add.json               Task 21
fixtures/legacy/parallel-add.json             Task 21
fixtures/versioned/simple-add.json            Task 21

tests/unit/document/types.test.ts             Task 3
tests/unit/document/ids.test.ts               Task 4
tests/unit/registry/registry.test.ts          Task 7
tests/unit/registry/builtIns.test.ts          Task 6
tests/unit/serializer/versioned.test.ts       Task 8
tests/unit/serializer/legacy.test.ts          Task 9
tests/unit/serializer/dispatch.test.ts        Task 10
tests/unit/serializer/roundtrip.test.ts       Task 10 (uses fixtures from Task 21; defer assertions until Task 21)
tests/unit/validator/duplicateNodeIds.test.ts Task 11
tests/unit/validator/unknownNodeType.test.ts  Task 12
tests/unit/validator/parameters.test.ts       Task 13
tests/unit/validator/edges.test.ts            Task 14
tests/unit/validator/ports.test.ts            Task 15
tests/unit/validator/frequency.test.ts        Task 16
tests/unit/validator/cycles.test.ts           Task 17
tests/unit/validator/warnings.test.ts         Task 18
tests/unit/validator/integration.test.ts      Task 19
tests/unit/compiler/compile.test.ts           Task 20

.github/workflows/ci.yml                      Task 22

CHANGELOG.md                                  Task 23 (modify)
PLAN.md                                       Task 23 (modify)
PROJECT_MEMORY.md                             Task 23 (modify)
```

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `.npmrc`, `tsconfig.json`, `vitest.config.ts`, `.eslintrc.cjs`, `.prettierrc`

- [ ] **Step 1.1: Write `package.json`.**

```json
{
  "name": "n8n-port",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22"
  },
  "packageManager": "pnpm@10.33.2",
  "scripts": {
    "lint": "eslint .",
    "format": "prettier --write --no-error-on-unmatched-pattern src tests",
    "format:check": "prettier --check --no-error-on-unmatched-pattern src tests",
    "typecheck": "tsc --noEmit",
    "test": "vitest --run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "zod": "^4"
  },
  "devDependencies": {
    "@eslint/js": "^10",
    "@types/node": "^22",
    "@vitest/coverage-v8": "^4",
    "eslint": "^10",
    "prettier": "^3",
    "typescript": "~6.0",
    "typescript-eslint": "^8.59",
    "vitest": "^4"
  }
}
```

- [ ] **Step 1.2: Write `.npmrc`.**

```
strict-peer-dependencies=true
auto-install-peers=true
```

- [ ] **Step 1.3: Write `tsconfig.json`.**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true,
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src/**/*", "tests/**/*", "vitest.config.ts"]
}
```

- [ ] **Step 1.4: Write `vitest.config.ts`.**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
    },
  },
});
```

- [ ] **Step 1.5: Write `eslint.config.js`.**

```js
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "*.config.js",
      "*.config.ts",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
```

- [ ] **Step 1.6: Write `.prettierrc`.**

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

- [ ] **Step 1.7: Install dependencies.**

Run: `pnpm install`
Expected: a `pnpm-lock.yaml` is produced and `node_modules/` is populated. No errors. Verify with `pnpm typecheck` (passes trivially since `src/` is empty) and `pnpm test` (passes with "no test files found" — vitest exits 0 when nothing matches; if it fails on this, add a single placeholder test in Step 1.8 *before* committing).

- [ ] **Step 1.8: Add a placeholder smoke test so vitest has at least one matching file.**

Create `tests/unit/_scaffold.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("scaffold", () => {
  it("vitest is wired up", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `pnpm test`
Expected: 1 passed.

- [ ] **Step 1.9: Verify lint, format, typecheck.**

Prettier 3 exits non-zero on glob patterns that match nothing, so the `format` and `format:check` scripts pass `--no-error-on-unmatched-pattern` to keep an empty `src/` from breaking verification before Phase 1 lands its first source file.

Run in sequence:
```
pnpm lint
pnpm format:check
pnpm typecheck
```
Expected: each exits 0. If `format:check` fails, run `pnpm format` and re-check.

- [ ] **Step 1.10: Commit.**

```bash
git add package.json pnpm-lock.yaml .npmrc tsconfig.json vitest.config.ts eslint.config.js .prettierrc tests/unit/_scaffold.test.ts
git commit -m "feat(scaffold): typescript / vitest / eslint / prettier project skeleton"
```

> **Note (2026-05-01 close):** in this branch's actual history, Step 1.10 was split across multiple commits as fixes were applied: `fc764de` (initial config files), `1fb6251` (flat ESLint config + verified version pins), `f88d675` (packageManager pinned to fully-qualified `pnpm@10.33.2` because corepack rejected the major-only form), and `3d7cb92` (install + smoke test + verify, plus the prettier `--no-error-on-unmatched-pattern` flag that the bare `src tests` glob would otherwise have failed on). A fresh execution from a clean repo, using the corrected plan above, will produce a single combined commit instead. Preserve this multi-commit history rather than rewriting it.

---

## Task 2: Diagnostic type and code constants

**Files:**
- Create: `src/validator/codes.ts`, `src/validator/diagnostics.ts`
- Test: `tests/unit/validator/codes.test.ts`

The `Diagnostic` shape comes directly from the spec §6.3. The `code` field is a stable string, used as the API for downstream consumers; messages are human text.

- [ ] **Step 2.1: Write the failing test.**

`tests/unit/validator/codes.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { CODES, type DiagnosticCode } from "../../../src/validator/codes";

describe("validator codes", () => {
  it("exposes a stable set of error and warning codes", () => {
    expect(CODES.DUPLICATE_NODE_ID).toBe("duplicate_node_id");
    expect(CODES.UNKNOWN_NODE_TYPE).toBe("unknown_node_type");
    expect(CODES.MISSING_REQUIRED_PARAMETER).toBe("missing_required_parameter");
    expect(CODES.PARAMETER_TYPE_MISMATCH).toBe("parameter_type_mismatch");
    expect(CODES.INVALID_FREQUENCY).toBe("invalid_frequency");
    expect(CODES.FREQUENCY_FOR_MISSING_NODE).toBe("frequency_for_missing_node");
    expect(CODES.DUPLICATE_EDGE_ID).toBe("duplicate_edge_id");
    expect(CODES.MISSING_SOURCE_NODE).toBe("missing_source_node");
    expect(CODES.MISSING_TARGET_NODE).toBe("missing_target_node");
    expect(CODES.INVALID_SOURCE_PORT).toBe("invalid_source_port");
    expect(CODES.INVALID_TARGET_PORT).toBe("invalid_target_port");
    expect(CODES.PORT_TYPE_MISMATCH).toBe("port_type_mismatch");
    expect(CODES.SELF_LOOP).toBe("self_loop");
    expect(CODES.CYCLE).toBe("cycle");
    expect(CODES.ISOLATED_NODE).toBe("isolated_node");
    expect(CODES.UNCONNECTED_INPUT).toBe("unconnected_input");
  });

  it("DiagnosticCode is the union of CODES values", () => {
    const _check: DiagnosticCode = "duplicate_node_id";
    expect(_check).toBe(CODES.DUPLICATE_NODE_ID);
  });
});
```

- [ ] **Step 2.2: Run; expect failure.**

Run: `pnpm test tests/unit/validator/codes.test.ts`
Expected: fails ("Cannot find module 'src/validator/codes'").

- [ ] **Step 2.3: Implement `src/validator/codes.ts`.**

```ts
export const CODES = {
  DUPLICATE_NODE_ID: "duplicate_node_id",
  UNKNOWN_NODE_TYPE: "unknown_node_type",
  MISSING_REQUIRED_PARAMETER: "missing_required_parameter",
  PARAMETER_TYPE_MISMATCH: "parameter_type_mismatch",
  INVALID_FREQUENCY: "invalid_frequency",
  FREQUENCY_FOR_MISSING_NODE: "frequency_for_missing_node",
  DUPLICATE_EDGE_ID: "duplicate_edge_id",
  MISSING_SOURCE_NODE: "missing_source_node",
  MISSING_TARGET_NODE: "missing_target_node",
  INVALID_SOURCE_PORT: "invalid_source_port",
  INVALID_TARGET_PORT: "invalid_target_port",
  PORT_TYPE_MISMATCH: "port_type_mismatch",
  SELF_LOOP: "self_loop",
  CYCLE: "cycle",
  ISOLATED_NODE: "isolated_node",
  UNCONNECTED_INPUT: "unconnected_input",
} as const;

export type DiagnosticCode = (typeof CODES)[keyof typeof CODES];
```

- [ ] **Step 2.4: Implement `src/validator/diagnostics.ts`.**

```ts
import * as z from "zod";
import type { DiagnosticCode } from "./codes";

export const DiagnosticSchema = z.object({
  severity: z.enum(["error", "warning"]),
  code: z.string(),
  message: z.string(),
  node_id: z.number().int().optional(),
  edge_id: z.string().optional(),
  field: z.string().optional(),
});

export type Diagnostic = z.infer<typeof DiagnosticSchema> & { code: DiagnosticCode };

export interface DiagnosticInit {
  code: DiagnosticCode;
  message: string;
  node_id?: number;
  edge_id?: string;
  field?: string;
}

export const error = (init: DiagnosticInit): Diagnostic => ({
  severity: "error",
  ...init,
});

export const warning = (init: DiagnosticInit): Diagnostic => ({
  severity: "warning",
  ...init,
});
```

- [ ] **Step 2.5: Run tests.**

Run: `pnpm test tests/unit/validator/codes.test.ts`
Expected: 2 passed.

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 2.6: Commit.**

```bash
git add src/validator/codes.ts src/validator/diagnostics.ts tests/unit/validator/codes.test.ts
git commit -m "feat(validator): diagnostic type, code constants, helpers"
```

---

## Task 3: GraphDocument types and Zod schemas

**Files:**
- Create: `src/document/types.ts`
- Test: `tests/unit/document/types.test.ts`

- [ ] **Step 3.1: Write the failing test.**

`tests/unit/document/types.test.ts`:

> Each test constructs its input as a fresh `unknown`-typed literal rather than `structuredClone`-ing a shared `valid` fixture. The shared-fixture pattern fails TypeScript's excess-property check under `exactOptionalPropertyTypes` when a test wants to add `frequency_hz` to a node literal that didn't declare it. Per-case literals avoid the issue without weakening test coverage.

```ts
import { describe, it, expect } from "vitest";
import { GraphDocumentSchema } from "../../../src/document/types";

const validInput = (): unknown => ({
  version: 1,
  graph: {
    nodes: [
      { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 2 } },
      { id: 2, type: "Print", position: { x: 100, y: 0 }, parameters: {} },
    ],
    edges: [
      {
        id: "e1",
        source: { node: 1, port: "out" },
        target: { node: 2, port: "in" },
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  },
});

describe("GraphDocumentSchema", () => {
  it("accepts a minimally valid versioned document", () => {
    expect(GraphDocumentSchema.safeParse(validInput()).success).toBe(true);
  });

  it("rejects wrong version", () => {
    const bad = { version: 2, graph: { nodes: [], edges: [] } };
    expect(GraphDocumentSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a node missing position", () => {
    const bad: unknown = {
      version: 1,
      graph: {
        nodes: [{ id: 1, type: "Constant", parameters: { value: 0 } }],
        edges: [],
      },
    };
    expect(GraphDocumentSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a non-integer node id", () => {
    const bad: unknown = {
      version: 1,
      graph: {
        nodes: [{ id: 1.5, type: "Print", position: { x: 0, y: 0 }, parameters: {} }],
        edges: [],
      },
    };
    expect(GraphDocumentSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts frequency_hz as a positive number, null, or omitted", () => {
    const input: unknown = {
      version: 1,
      graph: {
        nodes: [
          { id: 1, type: "Print", position: { x: 0, y: 0 }, parameters: {}, frequency_hz: 60 },
          { id: 2, type: "Print", position: { x: 0, y: 0 }, parameters: {}, frequency_hz: null },
          { id: 3, type: "Print", position: { x: 0, y: 0 }, parameters: {} },
        ],
        edges: [],
      },
    };
    expect(GraphDocumentSchema.safeParse(input).success).toBe(true);
  });

  it("rejects a non-positive frequency_hz", () => {
    const bad: unknown = {
      version: 1,
      graph: {
        nodes: [
          { id: 1, type: "Print", position: { x: 0, y: 0 }, parameters: {}, frequency_hz: 0 },
        ],
        edges: [],
      },
    };
    expect(GraphDocumentSchema.safeParse(bad).success).toBe(false);
  });
});
```

- [ ] **Step 3.2: Run; expect failure.**

Run: `pnpm test tests/unit/document/types.test.ts`
Expected: fails (module not found).

- [ ] **Step 3.3: Implement `src/document/types.ts`.**

```ts
import * as z from "zod";

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type Position = z.infer<typeof PositionSchema>;

export const NodeSchema = z.object({
  id: z.number().int(),
  name: z.string().optional(),
  type: z.string(),
  position: PositionSchema,
  parameters: z.record(z.string(), z.unknown()).default({}),
  frequency_hz: z.number().positive().nullable().optional(),
});
export type GraphNode = z.infer<typeof NodeSchema>;

export const EdgeEndpointSchema = z.object({
  node: z.number().int(),
  port: z.string(),
});
export type EdgeEndpoint = z.infer<typeof EdgeEndpointSchema>;

export const EdgeSchema = z.object({
  id: z.string(),
  source: EdgeEndpointSchema,
  target: EdgeEndpointSchema,
});
export type GraphEdge = z.infer<typeof EdgeSchema>;

export const ViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().positive(),
});
export type Viewport = z.infer<typeof ViewportSchema>;

export const GraphSchema = z.object({
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
  viewport: ViewportSchema.optional(),
});
export type Graph = z.infer<typeof GraphSchema>;

export const GraphDocumentSchema = z.object({
  version: z.literal(1),
  graph: GraphSchema,
});
export type GraphDocument = z.infer<typeof GraphDocumentSchema>;
```

- [ ] **Step 3.4: Run tests.**

Run: `pnpm test tests/unit/document/types.test.ts`
Expected: 6 passed.

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 3.5: Commit.**

```bash
git add src/document/types.ts tests/unit/document/types.test.ts
git commit -m "feat(document): GraphDocument zod schemas and inferred types"
```

---

## Task 4: ID allocators

**Files:**
- Create: `src/document/ids.ts`, `src/document/index.ts`
- Test: `tests/unit/document/ids.test.ts`

- [ ] **Step 4.1: Write the failing test.**

`tests/unit/document/ids.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { nextNodeId, edgeIdFor } from "../../../src/document/ids";
import type { GraphDocument } from "../../../src/document/types";

const empty: GraphDocument = { version: 1, graph: { nodes: [], edges: [] } };
const someDoc: GraphDocument = {
  version: 1,
  graph: {
    nodes: [
      { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: {} },
      { id: 7, type: "Add", position: { x: 0, y: 0 }, parameters: {} },
      { id: 4, type: "Print", position: { x: 0, y: 0 }, parameters: {} },
    ],
    edges: [],
  },
};

describe("nextNodeId", () => {
  it("starts at 1 for an empty document", () => {
    expect(nextNodeId(empty)).toBe(1);
  });

  it("returns max(existing) + 1", () => {
    expect(nextNodeId(someDoc)).toBe(8);
  });

  it("is deterministic and pure", () => {
    const a = nextNodeId(someDoc);
    const b = nextNodeId(someDoc);
    expect(a).toBe(b);
  });
});

describe("edgeIdFor", () => {
  it("produces e<src>_<srcPort>__<dst>_<dstPort>", () => {
    expect(edgeIdFor(1, "out", 2, "a")).toBe("e1_out__2_a");
  });
});
```

- [ ] **Step 4.2: Run; expect failure.**

Run: `pnpm test tests/unit/document/ids.test.ts`
Expected: module not found.

- [ ] **Step 4.3: Implement `src/document/ids.ts`.**

```ts
import type { GraphDocument } from "./types";

export const nextNodeId = (doc: GraphDocument): number => {
  const ids = doc.graph.nodes.map((n) => n.id);
  return ids.length === 0 ? 1 : Math.max(...ids) + 1;
};

export const edgeIdFor = (
  srcNode: number,
  srcPort: string,
  dstNode: number,
  dstPort: string,
): string => `e${srcNode}_${srcPort}__${dstNode}_${dstPort}`;
```

- [ ] **Step 4.4: Implement `src/document/index.ts` (barrel).**

```ts
export * from "./types";
export * from "./ids";
```

- [ ] **Step 4.5: Run tests + typecheck.**

Run: `pnpm test tests/unit/document/ids.test.ts && pnpm typecheck`
Expected: 4 passed; typecheck passes.

- [ ] **Step 4.6: Commit.**

```bash
git add src/document/ids.ts src/document/index.ts tests/unit/document/ids.test.ts
git commit -m "feat(document): node/edge id allocators"
```

---

## Task 5: NodeTypeDescription schema

**Files:**
- Create: `src/registry/types.ts`

(Tested via Task 6's built-in fixtures rather than a standalone test file — the schema only matters in conjunction with concrete node types.)

- [ ] **Step 5.1: Implement `src/registry/types.ts`.**

```ts
import * as z from "zod";

export const ParameterDescriptionSchema = z.object({
  type: z.string(),
  required: z.boolean().optional().default(false),
  default: z.unknown().optional(),
});
export type ParameterDescription = z.infer<typeof ParameterDescriptionSchema>;

export const PortDescriptionSchema = z.object({
  name: z.string(),
  type: z.string().optional(),
});
export type PortDescription = z.infer<typeof PortDescriptionSchema>;

export const NodeTypeDescriptionSchema = z.object({
  type: z.string(),
  display_name: z.string(),
  category: z.string(),
  inputs: z.array(PortDescriptionSchema),
  outputs: z.array(PortDescriptionSchema),
  parameters: z.record(z.string(), ParameterDescriptionSchema),
});
export type NodeTypeDescription = z.infer<typeof NodeTypeDescriptionSchema>;
```

- [ ] **Step 5.2: Run typecheck.**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 5.3: Commit.**

```bash
git add src/registry/types.ts
git commit -m "feat(registry): NodeTypeDescription zod schema and types"
```

---

## Task 6: Built-in node descriptions

**Files:**
- Create: `src/registry/builtIns.ts`
- Test: `tests/unit/registry/builtIns.test.ts`

- [ ] **Step 6.1: Write the failing test.**

`tests/unit/registry/builtIns.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { BUILT_IN_NODE_TYPES } from "../../../src/registry/builtIns";
import { NodeTypeDescriptionSchema } from "../../../src/registry/types";

describe("built-in node types", () => {
  it("contains Constant, Add, Print", () => {
    const types = BUILT_IN_NODE_TYPES.map((d) => d.type).sort();
    expect(types).toEqual(["Add", "Constant", "Print"]);
  });

  it("each entry passes the NodeTypeDescription schema", () => {
    for (const desc of BUILT_IN_NODE_TYPES) {
      const r = NodeTypeDescriptionSchema.safeParse(desc);
      expect(r.success, `${desc.type}: ${r.success ? "" : r.error.message}`).toBe(true);
    }
  });

  it("Constant has no inputs and one output 'out:int' with required value parameter", () => {
    const c = BUILT_IN_NODE_TYPES.find((d) => d.type === "Constant")!;
    expect(c.inputs).toEqual([]);
    expect(c.outputs).toEqual([{ name: "out", type: "int" }]);
    expect(c.parameters).toEqual({
      value: { type: "int", required: true, default: 0 },
    });
  });

  it("Add has inputs a:int and b:int, output sum:int, no parameters", () => {
    const a = BUILT_IN_NODE_TYPES.find((d) => d.type === "Add")!;
    expect(a.inputs).toEqual([
      { name: "a", type: "int" },
      { name: "b", type: "int" },
    ]);
    expect(a.outputs).toEqual([{ name: "sum", type: "int" }]);
    expect(a.parameters).toEqual({});
  });

  it("Print has input in:int, no outputs, no parameters", () => {
    const p = BUILT_IN_NODE_TYPES.find((d) => d.type === "Print")!;
    expect(p.inputs).toEqual([{ name: "in", type: "int" }]);
    expect(p.outputs).toEqual([]);
    expect(p.parameters).toEqual({});
  });
});
```

- [ ] **Step 6.2: Run; expect failure.**

Run: `pnpm test tests/unit/registry/builtIns.test.ts`
Expected: module not found.

- [ ] **Step 6.3: Implement `src/registry/builtIns.ts`.**

```ts
import type { NodeTypeDescription } from "./types";

const Constant: NodeTypeDescription = {
  type: "Constant",
  display_name: "Constant",
  category: "Input",
  inputs: [],
  outputs: [{ name: "out", type: "int" }],
  parameters: {
    value: { type: "int", required: true, default: 0 },
  },
};

const Add: NodeTypeDescription = {
  type: "Add",
  display_name: "Add",
  category: "Math",
  inputs: [
    { name: "a", type: "int" },
    { name: "b", type: "int" },
  ],
  outputs: [{ name: "sum", type: "int" }],
  parameters: {},
};

const Print: NodeTypeDescription = {
  type: "Print",
  display_name: "Print",
  category: "Output",
  inputs: [{ name: "in", type: "int" }],
  outputs: [],
  parameters: {},
};

export const BUILT_IN_NODE_TYPES: readonly NodeTypeDescription[] = [Constant, Add, Print];
```

- [ ] **Step 6.4: Run tests.**

Run: `pnpm test tests/unit/registry/builtIns.test.ts && pnpm typecheck`
Expected: 5 passed; typecheck passes.

- [ ] **Step 6.5: Commit.**

```bash
git add src/registry/builtIns.ts tests/unit/registry/builtIns.test.ts
git commit -m "feat(registry): built-in node descriptions for Constant/Add/Print"
```

---

## Task 7: NodeTypeRegistry implementation

**Files:**
- Create: `src/registry/registry.ts`, `src/registry/index.ts`
- Test: `tests/unit/registry/registry.test.ts`

- [ ] **Step 7.1: Write the failing test.**

`tests/unit/registry/registry.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createRegistry, defaultRegistry } from "../../../src/registry/registry";
import type { NodeTypeDescription } from "../../../src/registry/types";

const fakeType: NodeTypeDescription = {
  type: "Fake",
  display_name: "Fake",
  category: "Test",
  inputs: [],
  outputs: [],
  parameters: {},
};

describe("registry", () => {
  it("default registry exposes the three built-ins", () => {
    expect(defaultRegistry().get("Constant")?.type).toBe("Constant");
    expect(defaultRegistry().get("Add")?.type).toBe("Add");
    expect(defaultRegistry().get("Print")?.type).toBe("Print");
  });

  it("returns undefined for unknown types", () => {
    expect(defaultRegistry().get("NotARealType")).toBeUndefined();
  });

  it("all() returns every registered description", () => {
    expect(defaultRegistry().all().length).toBe(3);
  });

  it("createRegistry accepts an explicit list", () => {
    const r = createRegistry([fakeType]);
    expect(r.get("Fake")?.type).toBe("Fake");
    expect(r.all()).toHaveLength(1);
  });
});
```

- [ ] **Step 7.2: Run; expect failure.**

Run: `pnpm test tests/unit/registry/registry.test.ts`
Expected: module not found.

- [ ] **Step 7.3: Implement `src/registry/registry.ts`.**

```ts
import type { NodeTypeDescription } from "./types";
import { BUILT_IN_NODE_TYPES } from "./builtIns";

export interface NodeTypeRegistry {
  get(type: string): NodeTypeDescription | undefined;
  all(): NodeTypeDescription[];
}

export const createRegistry = (
  descriptions: readonly NodeTypeDescription[],
): NodeTypeRegistry => {
  const byType = new Map<string, NodeTypeDescription>();
  for (const d of descriptions) byType.set(d.type, d);
  return {
    get: (type) => byType.get(type),
    all: () => [...byType.values()],
  };
};

let _default: NodeTypeRegistry | undefined;
export const defaultRegistry = (): NodeTypeRegistry => {
  if (!_default) _default = createRegistry(BUILT_IN_NODE_TYPES);
  return _default;
};
```

- [ ] **Step 7.4: Implement `src/registry/index.ts` (barrel).**

```ts
export * from "./types";
export * from "./builtIns";
export * from "./registry";
```

- [ ] **Step 7.5: Run tests.**

Run: `pnpm test tests/unit/registry && pnpm typecheck`
Expected: all green.

- [ ] **Step 7.6: Commit.**

```bash
git add src/registry/registry.ts src/registry/index.ts tests/unit/registry/registry.test.ts
git commit -m "feat(registry): registry implementation with default + custom"
```

---

## Task 8: Versioned serializer (load + save)

**Files:**
- Create: `src/serializer/versioned.ts`
- Test: `tests/unit/serializer/versioned.test.ts`

- [ ] **Step 8.1: Write the failing test.**

`tests/unit/serializer/versioned.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { loadVersioned, saveVersioned } from "../../../src/serializer/versioned";
import type { GraphDocument } from "../../../src/document/types";

const doc: GraphDocument = {
  version: 1,
  graph: {
    nodes: [
      {
        id: 1,
        name: "Two",
        type: "Constant",
        position: { x: 0, y: 0 },
        parameters: { value: 2 },
      },
    ],
    edges: [],
  },
};

describe("versioned serializer", () => {
  it("saveVersioned produces a JSON string parseable as the same document", () => {
    const json = saveVersioned(doc);
    const parsed = JSON.parse(json) as unknown;
    const reloaded = loadVersioned(parsed);
    expect(reloaded.success).toBe(true);
    if (reloaded.success) expect(reloaded.data).toEqual(doc);
  });

  it("loadVersioned rejects an object missing the version field", () => {
    const r = loadVersioned({ graph: { nodes: [], edges: [] } });
    expect(r.success).toBe(false);
  });

  it("loadVersioned rejects a wrong version", () => {
    const r = loadVersioned({ version: 99, graph: { nodes: [], edges: [] } });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 8.2: Run; expect failure.**

Run: `pnpm test tests/unit/serializer/versioned.test.ts`
Expected: module not found.

- [ ] **Step 8.3: Implement `src/serializer/versioned.ts`.**

```ts
import { GraphDocumentSchema, type GraphDocument } from "../document/types";

export type LoadResult =
  | { success: true; data: GraphDocument }
  | { success: false; error: string };

export const loadVersioned = (input: unknown): LoadResult => {
  const r = GraphDocumentSchema.safeParse(input);
  if (r.success) return { success: true, data: r.data };
  return { success: false, error: r.error.message };
};

export const saveVersioned = (doc: GraphDocument): string =>
  JSON.stringify(doc, null, 2);
```

- [ ] **Step 8.4: Run tests + typecheck.**

Run: `pnpm test tests/unit/serializer/versioned.test.ts && pnpm typecheck`
Expected: 3 passed; typecheck passes.

- [ ] **Step 8.5: Commit.**

```bash
git add src/serializer/versioned.ts tests/unit/serializer/versioned.test.ts
git commit -m "feat(serializer): versioned load/save round-trip"
```

---

## Task 9: Legacy serializer (read-only)

**Files:**
- Create: `src/serializer/legacy.ts`
- Test: `tests/unit/serializer/legacy.test.ts`

The legacy format is described in the spec §6.5 and the prompt under "Legacy JSON Format". Loader behaviour:
- assigns deterministic default positions when missing (`(idx * 200, 0)`)
- preserves `name` if present
- maps `Constant.value` to `parameters.value`
- synthesises edge IDs via `edgeIdFor`

- [ ] **Step 9.1: Write the failing test.**

`tests/unit/serializer/legacy.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { loadLegacy } from "../../../src/serializer/legacy";

const sample = {
  nodes: [
    { uid: 1, name: "Two", type: "Constant", value: 2 },
    { uid: 2, name: "Three", type: "Constant", value: 3 },
    { uid: 3, name: "Adder", type: "Add" },
    { uid: 4, name: "Output", type: "Print" },
  ],
  edges: [
    { src: 1, dst: 3, port_out: "out", port_in: "a" },
    { src: 2, dst: 3, port_out: "out", port_in: "b" },
    { src: 3, dst: 4, port_out: "sum", port_in: "in" },
  ],
};

describe("loadLegacy", () => {
  it("loads the prompt's simple-add fixture", () => {
    const r = loadLegacy(sample);
    expect(r.success).toBe(true);
    if (!r.success) return;

    const ids = r.data.graph.nodes.map((n) => n.id).sort();
    expect(ids).toEqual([1, 2, 3, 4]);

    const names = r.data.graph.nodes.map((n) => n.name);
    expect(names).toEqual(["Two", "Three", "Adder", "Output"]);

    const constant = r.data.graph.nodes.find((n) => n.id === 1)!;
    expect(constant.parameters).toEqual({ value: 2 });

    expect(r.data.graph.edges).toHaveLength(3);
    expect(r.data.graph.edges[0]!.id).toBe("e1_out__3_a");
  });

  it("assigns default positions to nodes lacking position", () => {
    const r = loadLegacy(sample);
    if (!r.success) throw new Error("expected success");
    expect(r.data.graph.nodes[0]!.position).toEqual({ x: 0, y: 0 });
    expect(r.data.graph.nodes[1]!.position).toEqual({ x: 200, y: 0 });
  });

  it("rejects a missing required Constant.value", () => {
    const bad = { nodes: [{ uid: 1, type: "Constant" }], edges: [] };
    const r = loadLegacy(bad);
    expect(r.success).toBe(false);
  });

  it("rejects nodes with non-integer uid", () => {
    const bad = { nodes: [{ uid: "x", type: "Print" }], edges: [] };
    const r = loadLegacy(bad);
    expect(r.success).toBe(false);
  });

  it("preserves Add and Print without parameters", () => {
    const r = loadLegacy(sample);
    if (!r.success) throw new Error("expected success");
    const adder = r.data.graph.nodes.find((n) => n.id === 3)!;
    expect(adder.parameters).toEqual({});
    const printer = r.data.graph.nodes.find((n) => n.id === 4)!;
    expect(printer.parameters).toEqual({});
  });
});
```

- [ ] **Step 9.2: Run; expect failure.**

Run: `pnpm test tests/unit/serializer/legacy.test.ts`
Expected: module not found.

- [ ] **Step 9.3: Implement `src/serializer/legacy.ts`.**

```ts
import * as z from "zod";
import { edgeIdFor } from "../document/ids";
import type { GraphDocument, GraphNode, GraphEdge } from "../document/types";
import { GraphDocumentSchema } from "../document/types";
import type { LoadResult } from "./versioned";

const LegacyNodeSchema = z.object({
  uid: z.number().int(),
  name: z.string().optional(),
  type: z.string(),
  value: z.number().int().optional(),
});

const LegacyEdgeSchema = z.object({
  src: z.number().int(),
  dst: z.number().int(),
  port_out: z.string(),
  port_in: z.string(),
});

const LegacyShapeSchema = z.object({
  nodes: z.array(LegacyNodeSchema),
  edges: z.array(LegacyEdgeSchema),
});

const DEFAULT_X_STRIDE = 200;

export const loadLegacy = (input: unknown): LoadResult => {
  const r = LegacyShapeSchema.safeParse(input);
  if (!r.success) return { success: false, error: r.error.message };

  const nodes: GraphNode[] = r.data.nodes.map((n, idx): GraphNode => {
    const parameters: Record<string, unknown> = {};
    if (n.type === "Constant") {
      if (n.value === undefined) {
        throw new ZodFailure(`Constant node ${n.uid} missing required value`);
      }
      parameters.value = n.value;
    }
    return {
      id: n.uid,
      ...(n.name !== undefined ? { name: n.name } : {}),
      type: n.type,
      position: { x: idx * DEFAULT_X_STRIDE, y: 0 },
      parameters,
    };
  });

  const edges: GraphEdge[] = r.data.edges.map((e): GraphEdge => ({
    id: edgeIdFor(e.src, e.port_out, e.dst, e.port_in),
    source: { node: e.src, port: e.port_out },
    target: { node: e.dst, port: e.port_in },
  }));

  const doc: GraphDocument = { version: 1, graph: { nodes, edges } };
  const final = GraphDocumentSchema.safeParse(doc);
  if (!final.success) return { success: false, error: final.error.message };
  return { success: true, data: final.data };
};

class ZodFailure extends Error {}

const _wrap = (fn: () => LoadResult): LoadResult => {
  try {
    return fn();
  } catch (e) {
    if (e instanceof ZodFailure) return { success: false, error: e.message };
    throw e;
  }
};

export const safeLoadLegacy = (input: unknown): LoadResult => _wrap(() => loadLegacy(input));
```

> Note: `loadLegacy` may throw `ZodFailure` for the "Constant missing value" case during the `.map()` traversal because the legacy schema marks `value` as optional (it's required *only* for Constant). `safeLoadLegacy` is the public surface that catches this and returns `{success:false}`. Tests in Step 9.1 pass through `safeLoadLegacy` indirectly via Task 10's dispatch, so the legacy-only test imports should call `safeLoadLegacy` for the rejection cases. Update the test to import that name now.

- [ ] **Step 9.4: Update the test to use `safeLoadLegacy` for the rejection cases.**

In `tests/unit/serializer/legacy.test.ts`, replace the import line with:
```ts
import { safeLoadLegacy as loadLegacy } from "../../../src/serializer/legacy";
```

(The success-path tests work the same way under either name; this single import keeps the file's body unchanged.)

- [ ] **Step 9.5: Run tests + typecheck.**

Run: `pnpm test tests/unit/serializer/legacy.test.ts && pnpm typecheck`
Expected: 5 passed; typecheck passes.

- [ ] **Step 9.6: Commit.**

```bash
git add src/serializer/legacy.ts tests/unit/serializer/legacy.test.ts
git commit -m "feat(serializer): legacy read-only loader with port name preservation"
```

---

## Task 10: Auto-detect serializer dispatch

**Files:**
- Create: `src/serializer/index.ts`
- Test: `tests/unit/serializer/dispatch.test.ts`

Detect rules:
- Top-level `version` and `graph` → versioned
- Top-level `nodes` and `edges` without `version` → legacy
- Otherwise → error

- [ ] **Step 10.1: Write the failing test.**

`tests/unit/serializer/dispatch.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { loadGraph } from "../../../src/serializer";

describe("loadGraph (dispatch)", () => {
  it("dispatches to versioned for { version, graph }", () => {
    const r = loadGraph({ version: 1, graph: { nodes: [], edges: [] } });
    expect(r.success).toBe(true);
  });

  it("dispatches to legacy for top-level nodes/edges without version", () => {
    const r = loadGraph({ nodes: [{ uid: 1, type: "Print" }], edges: [] });
    expect(r.success).toBe(true);
  });

  it("rejects a shape that's neither", () => {
    const r = loadGraph({ foo: 1 });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 10.2: Run; expect failure.**

Run: `pnpm test tests/unit/serializer/dispatch.test.ts`
Expected: module not found.

- [ ] **Step 10.3: Implement `src/serializer/index.ts`.**

```ts
import { loadVersioned, saveVersioned } from "./versioned";
import { safeLoadLegacy } from "./legacy";
import type { LoadResult } from "./versioned";

export type { LoadResult };
export { loadVersioned, saveVersioned, safeLoadLegacy };

const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null;

export const loadGraph = (input: unknown): LoadResult => {
  if (!isObject(input)) {
    return { success: false, error: "graph JSON must be an object" };
  }
  if ("version" in input && "graph" in input) return loadVersioned(input);
  if ("nodes" in input && "edges" in input) return safeLoadLegacy(input);
  return {
    success: false,
    error: "graph JSON must have either { version, graph } (versioned) or { nodes, edges } (legacy)",
  };
};
```

- [ ] **Step 10.4: Run tests + typecheck.**

Run: `pnpm test tests/unit/serializer && pnpm typecheck`
Expected: green.

- [ ] **Step 10.5: Commit.**

```bash
git add src/serializer/index.ts tests/unit/serializer/dispatch.test.ts
git commit -m "feat(serializer): auto-detect dispatch (versioned vs legacy)"
```

---

## Task 11: Validator rule — duplicate / missing node IDs

**Files:**
- Create: `src/validator/rules/duplicateNodeIds.ts`
- Test: `tests/unit/validator/duplicateNodeIds.test.ts`

(The "missing node ID" check applies to edge endpoints — covered in Task 14. This rule covers duplicates only.)

- [ ] **Step 11.1: Write the failing test.**

`tests/unit/validator/duplicateNodeIds.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { checkDuplicateNodeIds } from "../../../src/validator/rules/duplicateNodeIds";
import type { GraphDocument } from "../../../src/document/types";

const make = (ids: number[]): GraphDocument => ({
  version: 1,
  graph: {
    nodes: ids.map((id) => ({
      id,
      type: "Print",
      position: { x: 0, y: 0 },
      parameters: {},
    })),
    edges: [],
  },
});

describe("checkDuplicateNodeIds", () => {
  it("returns no diagnostics when all IDs are unique", () => {
    expect(checkDuplicateNodeIds(make([1, 2, 3]))).toEqual([]);
  });

  it("emits an error per duplicate ID with severity error and code duplicate_node_id", () => {
    const diags = checkDuplicateNodeIds(make([1, 2, 1, 2, 2]));
    expect(diags.every((d) => d.severity === "error")).toBe(true);
    expect(diags.every((d) => d.code === "duplicate_node_id")).toBe(true);
    expect(new Set(diags.map((d) => d.node_id))).toEqual(new Set([1, 2]));
  });
});
```

- [ ] **Step 11.2: Run; expect failure.**

Run: `pnpm test tests/unit/validator/duplicateNodeIds.test.ts`
Expected: module not found.

- [ ] **Step 11.3: Implement `src/validator/rules/duplicateNodeIds.ts`.**

```ts
import type { GraphDocument } from "../../document/types";
import type { Diagnostic } from "../diagnostics";
import { error } from "../diagnostics";
import { CODES } from "../codes";

export const checkDuplicateNodeIds = (doc: GraphDocument): Diagnostic[] => {
  const counts = new Map<number, number>();
  for (const n of doc.graph.nodes) counts.set(n.id, (counts.get(n.id) ?? 0) + 1);
  const out: Diagnostic[] = [];
  for (const [id, count] of counts) {
    if (count > 1) {
      out.push(
        error({
          code: CODES.DUPLICATE_NODE_ID,
          message: `Node ID ${id} is used by ${count} nodes`,
          node_id: id,
        }),
      );
    }
  }
  return out;
};
```

- [ ] **Step 11.4: Run tests + typecheck.**

Run: `pnpm test tests/unit/validator/duplicateNodeIds.test.ts && pnpm typecheck`
Expected: 2 passed.

- [ ] **Step 11.5: Commit.**

```bash
git add src/validator/rules/duplicateNodeIds.ts tests/unit/validator/duplicateNodeIds.test.ts
git commit -m "feat(validator): duplicate-node-id rule"
```

---

## Task 12: Validator rule — unknown node types

**Files:**
- Create: `src/validator/rules/unknownNodeType.ts`
- Test: `tests/unit/validator/unknownNodeType.test.ts`

- [ ] **Step 12.1: Write the failing test.**

`tests/unit/validator/unknownNodeType.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { checkUnknownNodeType } from "../../../src/validator/rules/unknownNodeType";
import { defaultRegistry } from "../../../src/registry/registry";
import type { GraphDocument } from "../../../src/document/types";

const doc = (type: string): GraphDocument => ({
  version: 1,
  graph: {
    nodes: [{ id: 1, type, position: { x: 0, y: 0 }, parameters: {} }],
    edges: [],
  },
});

describe("checkUnknownNodeType", () => {
  it("returns no diagnostics for known types", () => {
    expect(checkUnknownNodeType(doc("Constant"), defaultRegistry())).toEqual([]);
  });

  it("emits unknown_node_type for unrecognised types", () => {
    const diags = checkUnknownNodeType(doc("Frobulator"), defaultRegistry());
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("unknown_node_type");
    expect(diags[0]!.severity).toBe("error");
    expect(diags[0]!.node_id).toBe(1);
  });
});
```

- [ ] **Step 12.2: Run; expect failure.** `pnpm test tests/unit/validator/unknownNodeType.test.ts` → module not found.

- [ ] **Step 12.3: Implement `src/validator/rules/unknownNodeType.ts`.**

```ts
import type { GraphDocument } from "../../document/types";
import type { Diagnostic } from "../diagnostics";
import type { NodeTypeRegistry } from "../../registry/registry";
import { error } from "../diagnostics";
import { CODES } from "../codes";

export const checkUnknownNodeType = (
  doc: GraphDocument,
  registry: NodeTypeRegistry,
): Diagnostic[] => {
  const out: Diagnostic[] = [];
  for (const n of doc.graph.nodes) {
    if (!registry.get(n.type)) {
      out.push(
        error({
          code: CODES.UNKNOWN_NODE_TYPE,
          message: `Node ${n.id} has unknown type "${n.type}"`,
          node_id: n.id,
          field: "type",
        }),
      );
    }
  }
  return out;
};
```

- [ ] **Step 12.4: Run + commit.**

```bash
pnpm test tests/unit/validator/unknownNodeType.test.ts && pnpm typecheck
git add src/validator/rules/unknownNodeType.ts tests/unit/validator/unknownNodeType.test.ts
git commit -m "feat(validator): unknown-node-type rule"
```

---

## Task 13: Validator rule — parameters

**Files:**
- Create: `src/validator/rules/parameters.ts`
- Test: `tests/unit/validator/parameters.test.ts`

Checks:
- A required parameter declared on the type but absent from the node → `missing_required_parameter`.
- A parameter present on the node whose JS type doesn't match the declared `type` ("int", "float", "string", "bool") → `parameter_type_mismatch`.

Type-checking convention:
- `"int"` → JS `number` and `Number.isInteger(v)`
- `"float"` → JS `number`
- `"string"` → JS `string`
- `"bool"` → JS `boolean`
- any other type label is treated as opaque (skip type check)

- [ ] **Step 13.1: Write the failing test.**

`tests/unit/validator/parameters.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { checkParameters } from "../../../src/validator/rules/parameters";
import { defaultRegistry } from "../../../src/registry/registry";
import type { GraphDocument } from "../../../src/document/types";

const node = (parameters: Record<string, unknown>): GraphDocument => ({
  version: 1,
  graph: {
    nodes: [{ id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters }],
    edges: [],
  },
});

describe("checkParameters", () => {
  it("passes for a valid Constant.value", () => {
    expect(checkParameters(node({ value: 5 }), defaultRegistry())).toEqual([]);
  });

  it("flags a missing required Constant.value", () => {
    const diags = checkParameters(node({}), defaultRegistry());
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("missing_required_parameter");
    expect(diags[0]!.field).toBe("value");
    expect(diags[0]!.node_id).toBe(1);
  });

  it("flags a wrong-type Constant.value", () => {
    const diags = checkParameters(node({ value: "five" }), defaultRegistry());
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("parameter_type_mismatch");
    expect(diags[0]!.field).toBe("value");
  });

  it("flags a non-integer where 'int' is required", () => {
    const diags = checkParameters(node({ value: 1.5 }), defaultRegistry());
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("parameter_type_mismatch");
  });

  it("ignores unknown node types (handled elsewhere)", () => {
    const doc: GraphDocument = {
      version: 1,
      graph: {
        nodes: [{ id: 9, type: "MysteryNode", position: { x: 0, y: 0 }, parameters: {} }],
        edges: [],
      },
    };
    expect(checkParameters(doc, defaultRegistry())).toEqual([]);
  });
});
```

- [ ] **Step 13.2: Run; expect failure.**

Run: `pnpm test tests/unit/validator/parameters.test.ts`
Expected: module not found.

- [ ] **Step 13.3: Implement `src/validator/rules/parameters.ts`.**

```ts
import type { GraphDocument } from "../../document/types";
import type { Diagnostic } from "../diagnostics";
import type { NodeTypeRegistry } from "../../registry/registry";
import { error } from "../diagnostics";
import { CODES } from "../codes";

const matchesType = (value: unknown, declared: string): boolean => {
  switch (declared) {
    case "int":
      return typeof value === "number" && Number.isInteger(value);
    case "float":
      return typeof value === "number";
    case "string":
      return typeof value === "string";
    case "bool":
      return typeof value === "boolean";
    default:
      return true;
  }
};

export const checkParameters = (
  doc: GraphDocument,
  registry: NodeTypeRegistry,
): Diagnostic[] => {
  const out: Diagnostic[] = [];
  for (const n of doc.graph.nodes) {
    const desc = registry.get(n.type);
    if (!desc) continue;
    for (const [key, schema] of Object.entries(desc.parameters)) {
      const present = key in n.parameters;
      if (schema.required && !present) {
        out.push(
          error({
            code: CODES.MISSING_REQUIRED_PARAMETER,
            message: `Node ${n.id} (${n.type}) is missing required parameter "${key}"`,
            node_id: n.id,
            field: key,
          }),
        );
        continue;
      }
      if (present && !matchesType(n.parameters[key], schema.type)) {
        out.push(
          error({
            code: CODES.PARAMETER_TYPE_MISMATCH,
            message: `Node ${n.id} (${n.type}) parameter "${key}" expected ${schema.type}`,
            node_id: n.id,
            field: key,
          }),
        );
      }
    }
  }
  return out;
};
```

- [ ] **Step 13.4: Run + commit.**

```bash
pnpm test tests/unit/validator/parameters.test.ts && pnpm typecheck
git add src/validator/rules/parameters.ts tests/unit/validator/parameters.test.ts
git commit -m "feat(validator): parameter required/type rules"
```

---

## Task 14: Validator rule — edges (IDs and endpoint nodes)

**Files:**
- Create: `src/validator/rules/edges.ts`
- Test: `tests/unit/validator/edges.test.ts`

Checks:
- duplicate edge IDs → `duplicate_edge_id` (one per duplicated id)
- source node missing from `nodes[]` → `missing_source_node`
- target node missing → `missing_target_node`
- self-loop (`source.node === target.node`) → `self_loop`

- [ ] **Step 14.1: Write the failing test.**

`tests/unit/validator/edges.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { checkEdges } from "../../../src/validator/rules/edges";
import type { GraphDocument } from "../../../src/document/types";

const node = (id: number) => ({
  id,
  type: "Print",
  position: { x: 0, y: 0 },
  parameters: {},
});

describe("checkEdges", () => {
  it("passes a graph with valid distinct edges", () => {
    const doc: GraphDocument = {
      version: 1,
      graph: {
        nodes: [node(1), node(2)],
        edges: [
          { id: "e1", source: { node: 1, port: "out" }, target: { node: 2, port: "in" } },
        ],
      },
    };
    expect(checkEdges(doc)).toEqual([]);
  });

  it("flags duplicate edge IDs", () => {
    const doc: GraphDocument = {
      version: 1,
      graph: {
        nodes: [node(1), node(2)],
        edges: [
          { id: "x", source: { node: 1, port: "a" }, target: { node: 2, port: "b" } },
          { id: "x", source: { node: 1, port: "c" }, target: { node: 2, port: "d" } },
        ],
      },
    };
    const diags = checkEdges(doc);
    expect(diags.some((d) => d.code === "duplicate_edge_id" && d.edge_id === "x")).toBe(true);
  });

  it("flags missing source and missing target", () => {
    const doc: GraphDocument = {
      version: 1,
      graph: {
        nodes: [node(1)],
        edges: [
          { id: "e1", source: { node: 99, port: "out" }, target: { node: 1, port: "in" } },
          { id: "e2", source: { node: 1, port: "out" }, target: { node: 100, port: "in" } },
        ],
      },
    };
    const codes = checkEdges(doc).map((d) => d.code);
    expect(codes).toContain("missing_source_node");
    expect(codes).toContain("missing_target_node");
  });

  it("flags a self-loop", () => {
    const doc: GraphDocument = {
      version: 1,
      graph: {
        nodes: [node(1)],
        edges: [
          { id: "loop", source: { node: 1, port: "out" }, target: { node: 1, port: "in" } },
        ],
      },
    };
    const diags = checkEdges(doc);
    expect(diags.some((d) => d.code === "self_loop" && d.edge_id === "loop")).toBe(true);
  });
});
```

- [ ] **Step 14.2: Run; expect failure.** Module not found.

- [ ] **Step 14.3: Implement `src/validator/rules/edges.ts`.**

```ts
import type { GraphDocument } from "../../document/types";
import type { Diagnostic } from "../diagnostics";
import { error } from "../diagnostics";
import { CODES } from "../codes";

export const checkEdges = (doc: GraphDocument): Diagnostic[] => {
  const out: Diagnostic[] = [];
  const nodeIds = new Set(doc.graph.nodes.map((n) => n.id));

  const idCounts = new Map<string, number>();
  for (const e of doc.graph.edges) idCounts.set(e.id, (idCounts.get(e.id) ?? 0) + 1);
  for (const [id, count] of idCounts) {
    if (count > 1) {
      out.push(
        error({
          code: CODES.DUPLICATE_EDGE_ID,
          message: `Edge ID "${id}" is used by ${count} edges`,
          edge_id: id,
        }),
      );
    }
  }

  for (const e of doc.graph.edges) {
    if (!nodeIds.has(e.source.node)) {
      out.push(
        error({
          code: CODES.MISSING_SOURCE_NODE,
          message: `Edge "${e.id}" references missing source node ${e.source.node}`,
          edge_id: e.id,
          field: "source.node",
        }),
      );
    }
    if (!nodeIds.has(e.target.node)) {
      out.push(
        error({
          code: CODES.MISSING_TARGET_NODE,
          message: `Edge "${e.id}" references missing target node ${e.target.node}`,
          edge_id: e.id,
          field: "target.node",
        }),
      );
    }
    if (e.source.node === e.target.node) {
      out.push(
        error({
          code: CODES.SELF_LOOP,
          message: `Edge "${e.id}" is a self-loop on node ${e.source.node}`,
          edge_id: e.id,
        }),
      );
    }
  }
  return out;
};
```

- [ ] **Step 14.4: Run + commit.**

```bash
pnpm test tests/unit/validator/edges.test.ts && pnpm typecheck
git add src/validator/rules/edges.ts tests/unit/validator/edges.test.ts
git commit -m "feat(validator): edge id/endpoint/self-loop rules"
```

---

## Task 15: Validator rule — port names and types

**Files:**
- Create: `src/validator/rules/ports.ts`
- Test: `tests/unit/validator/ports.test.ts`

Checks (only when both endpoint nodes exist and have known types):
- source output port not declared on source type → `invalid_source_port`
- target input port not declared on target type → `invalid_target_port`
- both ports declare a type and they differ → `port_type_mismatch`

- [ ] **Step 15.1: Write the failing test.**

`tests/unit/validator/ports.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { checkPorts } from "../../../src/validator/rules/ports";
import { defaultRegistry } from "../../../src/registry/registry";
import type { GraphDocument } from "../../../src/document/types";

const constNode = (id: number) => ({
  id,
  type: "Constant",
  position: { x: 0, y: 0 },
  parameters: { value: 0 },
});
const addNode = (id: number) => ({
  id,
  type: "Add",
  position: { x: 0, y: 0 },
  parameters: {},
});
const printNode = (id: number) => ({
  id,
  type: "Print",
  position: { x: 0, y: 0 },
  parameters: {},
});

describe("checkPorts", () => {
  it("passes valid edges", () => {
    const doc: GraphDocument = {
      version: 1,
      graph: {
        nodes: [constNode(1), addNode(2), printNode(3)],
        edges: [
          { id: "e1", source: { node: 1, port: "out" }, target: { node: 2, port: "a" } },
          { id: "e2", source: { node: 2, port: "sum" }, target: { node: 3, port: "in" } },
        ],
      },
    };
    expect(checkPorts(doc, defaultRegistry())).toEqual([]);
  });

  it("flags an invalid source port", () => {
    const doc: GraphDocument = {
      version: 1,
      graph: {
        nodes: [constNode(1), printNode(2)],
        edges: [
          { id: "e", source: { node: 1, port: "wrong" }, target: { node: 2, port: "in" } },
        ],
      },
    };
    const diags = checkPorts(doc, defaultRegistry());
    expect(diags.some((d) => d.code === "invalid_source_port")).toBe(true);
  });

  it("flags an invalid target port", () => {
    const doc: GraphDocument = {
      version: 1,
      graph: {
        nodes: [constNode(1), addNode(2)],
        edges: [
          { id: "e", source: { node: 1, port: "out" }, target: { node: 2, port: "c" } },
        ],
      },
    };
    const diags = checkPorts(doc, defaultRegistry());
    expect(diags.some((d) => d.code === "invalid_target_port")).toBe(true);
  });
});
```

- [ ] **Step 15.2: Run; expect failure.** Module not found.

- [ ] **Step 15.3: Implement `src/validator/rules/ports.ts`.**

```ts
import type { GraphDocument } from "../../document/types";
import type { Diagnostic } from "../diagnostics";
import type { NodeTypeRegistry } from "../../registry/registry";
import { error } from "../diagnostics";
import { CODES } from "../codes";

export const checkPorts = (
  doc: GraphDocument,
  registry: NodeTypeRegistry,
): Diagnostic[] => {
  const out: Diagnostic[] = [];
  const nodesById = new Map(doc.graph.nodes.map((n) => [n.id, n]));

  for (const e of doc.graph.edges) {
    const src = nodesById.get(e.source.node);
    const dst = nodesById.get(e.target.node);
    if (!src || !dst) continue;

    const srcDesc = registry.get(src.type);
    const dstDesc = registry.get(dst.type);
    if (!srcDesc || !dstDesc) continue;

    const srcOut = srcDesc.outputs.find((p) => p.name === e.source.port);
    const dstIn = dstDesc.inputs.find((p) => p.name === e.target.port);

    if (!srcOut) {
      out.push(
        error({
          code: CODES.INVALID_SOURCE_PORT,
          message: `Edge "${e.id}" references unknown output port "${e.source.port}" on ${src.type} (node ${src.id})`,
          edge_id: e.id,
          field: "source.port",
        }),
      );
    }
    if (!dstIn) {
      out.push(
        error({
          code: CODES.INVALID_TARGET_PORT,
          message: `Edge "${e.id}" references unknown input port "${e.target.port}" on ${dst.type} (node ${dst.id})`,
          edge_id: e.id,
          field: "target.port",
        }),
      );
    }
    if (srcOut?.type && dstIn?.type && srcOut.type !== dstIn.type) {
      out.push(
        error({
          code: CODES.PORT_TYPE_MISMATCH,
          message: `Edge "${e.id}" connects ${srcOut.type} → ${dstIn.type}`,
          edge_id: e.id,
        }),
      );
    }
  }
  return out;
};
```

- [ ] **Step 15.4: Run + commit.**

```bash
pnpm test tests/unit/validator/ports.test.ts && pnpm typecheck
git add src/validator/rules/ports.ts tests/unit/validator/ports.test.ts
git commit -m "feat(validator): port name and type rules"
```

---

## Task 16: Validator rule — frequency

**Files:**
- Create: `src/validator/rules/frequency.ts`
- Test: `tests/unit/validator/frequency.test.ts`

Checks:
- `frequency_hz` is `null` or `undefined` → no check.
- `frequency_hz` non-positive → `invalid_frequency` (already enforced by Zod, but we still check defensively for documents that bypass schema).
- A node referenced by frequency that no longer exists → `frequency_for_missing_node`. *(In our model, frequency lives on the node, so this only triggers if a future external map is introduced. We still implement the rule for completeness; in v1 it always passes for documents loaded via Zod, but the rule fires for documents constructed in-memory with a divergent freq map. To exercise it, we'll feed the rule a synthetic input.)*

- [ ] **Step 16.1: Write the failing test.**

`tests/unit/validator/frequency.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { checkFrequency } from "../../../src/validator/rules/frequency";
import type { GraphDocument } from "../../../src/document/types";

const make = (freq: number | null | undefined): GraphDocument => {
  const node = {
    id: 1,
    type: "Print",
    position: { x: 0, y: 0 },
    parameters: {},
    ...(freq === undefined ? {} : { frequency_hz: freq }),
  } as GraphDocument["graph"]["nodes"][number];
  return { version: 1, graph: { nodes: [node], edges: [] } };
};

describe("checkFrequency", () => {
  it("passes when no frequency set", () => {
    expect(checkFrequency(make(undefined))).toEqual([]);
  });
  it("passes when frequency is null", () => {
    expect(checkFrequency(make(null))).toEqual([]);
  });
  it("passes when frequency is positive", () => {
    expect(checkFrequency(make(60))).toEqual([]);
  });
  it("flags zero frequency", () => {
    const doc = make(0);
    const diags = checkFrequency(doc);
    expect(diags.some((d) => d.code === "invalid_frequency")).toBe(true);
  });
  it("flags negative frequency", () => {
    const diags = checkFrequency(make(-5));
    expect(diags.some((d) => d.code === "invalid_frequency")).toBe(true);
  });
});
```

- [ ] **Step 16.2: Run; expect failure.** Module not found.

- [ ] **Step 16.3: Implement `src/validator/rules/frequency.ts`.**

```ts
import type { GraphDocument } from "../../document/types";
import type { Diagnostic } from "../diagnostics";
import { error } from "../diagnostics";
import { CODES } from "../codes";

export const checkFrequency = (doc: GraphDocument): Diagnostic[] => {
  const out: Diagnostic[] = [];
  for (const n of doc.graph.nodes) {
    const f = n.frequency_hz;
    if (f === undefined || f === null) continue;
    if (!(f > 0)) {
      out.push(
        error({
          code: CODES.INVALID_FREQUENCY,
          message: `Node ${n.id} has non-positive frequency_hz ${f}`,
          node_id: n.id,
          field: "frequency_hz",
        }),
      );
    }
  }
  return out;
};
```

> The `frequency_for_missing_node` case is unreachable in the current document model (frequency is a per-node field, so it can't outlive its node). Leave the constant `CODES.FREQUENCY_FOR_MISSING_NODE` defined for protocol parity but do not emit it from any rule in this phase. Document this in the rule's commit message.

- [ ] **Step 16.4: Run + commit.**

```bash
pnpm test tests/unit/validator/frequency.test.ts && pnpm typecheck
git add src/validator/rules/frequency.ts tests/unit/validator/frequency.test.ts
git commit -m "feat(validator): frequency_hz rule

frequency_for_missing_node code reserved but not currently emitted; the
in-memory document model attaches frequency to the node, so the case is
only reachable if we later split frequency into a side map. Code constant
retained for protocol parity."
```

---

## Task 17: Validator rule — cycles

**Files:**
- Create: `src/validator/rules/cycles.ts`
- Test: `tests/unit/validator/cycles.test.ts`

Use Kahn's algorithm: build adjacency, in-degree, repeatedly peel zero-in-degree nodes. If any node remains, the rest form (or feed) cycles. Emit one `cycle` diagnostic per remaining strongly-connected component, listing involved nodes in `message`.

Self-loops are already handled by Task 14; this rule excludes self-edges and otherwise finds longer cycles.

- [ ] **Step 17.1: Write the failing test.**

`tests/unit/validator/cycles.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { checkCycles } from "../../../src/validator/rules/cycles";
import type { GraphDocument } from "../../../src/document/types";

const node = (id: number) => ({
  id,
  type: "Print",
  position: { x: 0, y: 0 },
  parameters: {},
});

describe("checkCycles", () => {
  it("passes a DAG", () => {
    const doc: GraphDocument = {
      version: 1,
      graph: {
        nodes: [node(1), node(2), node(3)],
        edges: [
          { id: "a", source: { node: 1, port: "x" }, target: { node: 2, port: "y" } },
          { id: "b", source: { node: 2, port: "x" }, target: { node: 3, port: "y" } },
        ],
      },
    };
    expect(checkCycles(doc)).toEqual([]);
  });

  it("flags a 2-cycle", () => {
    const doc: GraphDocument = {
      version: 1,
      graph: {
        nodes: [node(1), node(2)],
        edges: [
          { id: "a", source: { node: 1, port: "x" }, target: { node: 2, port: "y" } },
          { id: "b", source: { node: 2, port: "x" }, target: { node: 1, port: "y" } },
        ],
      },
    };
    const diags = checkCycles(doc);
    expect(diags.length).toBeGreaterThanOrEqual(1);
    expect(diags[0]!.code).toBe("cycle");
  });

  it("ignores self-loops (covered by edges rule)", () => {
    const doc: GraphDocument = {
      version: 1,
      graph: {
        nodes: [node(1)],
        edges: [
          { id: "loop", source: { node: 1, port: "x" }, target: { node: 1, port: "y" } },
        ],
      },
    };
    expect(checkCycles(doc)).toEqual([]);
  });
});
```

- [ ] **Step 17.2: Run; expect failure.** Module not found.

- [ ] **Step 17.3: Implement `src/validator/rules/cycles.ts`.**

```ts
import type { GraphDocument } from "../../document/types";
import type { Diagnostic } from "../diagnostics";
import { error } from "../diagnostics";
import { CODES } from "../codes";

export const checkCycles = (doc: GraphDocument): Diagnostic[] => {
  const ids = doc.graph.nodes.map((n) => n.id);
  const inDegree = new Map<number, number>();
  const adj = new Map<number, number[]>();
  for (const id of ids) {
    inDegree.set(id, 0);
    adj.set(id, []);
  }
  for (const e of doc.graph.edges) {
    if (e.source.node === e.target.node) continue;
    if (!inDegree.has(e.source.node) || !inDegree.has(e.target.node)) continue;
    adj.get(e.source.node)!.push(e.target.node);
    inDegree.set(e.target.node, inDegree.get(e.target.node)! + 1);
  }

  const queue: number[] = [];
  for (const [id, d] of inDegree) if (d === 0) queue.push(id);
  let processed = 0;
  while (queue.length > 0) {
    const id = queue.shift()!;
    processed += 1;
    for (const next of adj.get(id)!) {
      const d = inDegree.get(next)! - 1;
      inDegree.set(next, d);
      if (d === 0) queue.push(next);
    }
  }

  if (processed === ids.length) return [];

  const remaining = [...inDegree].filter(([, d]) => d > 0).map(([id]) => id);
  return [
    error({
      code: CODES.CYCLE,
      message: `Graph contains a cycle involving node(s): ${remaining.join(", ")}`,
    }),
  ];
};
```

- [ ] **Step 17.4: Run + commit.**

```bash
pnpm test tests/unit/validator/cycles.test.ts && pnpm typecheck
git add src/validator/rules/cycles.ts tests/unit/validator/cycles.test.ts
git commit -m "feat(validator): cycle detection via kahn's algorithm"
```

---

## Task 18: Validator warnings — isolated nodes and unconnected inputs

**Files:**
- Create: `src/validator/rules/warnings.ts`
- Test: `tests/unit/validator/warnings.test.ts`

Rules:
- A node with zero incoming and zero outgoing edges → `isolated_node` warning.
- A non-isolated node whose declared input port has no incoming edge → `unconnected_input` warning per missing port.

- [ ] **Step 18.1: Write the failing test.**

`tests/unit/validator/warnings.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { checkWarnings } from "../../../src/validator/rules/warnings";
import { defaultRegistry } from "../../../src/registry/registry";
import type { GraphDocument } from "../../../src/document/types";

describe("checkWarnings", () => {
  it("flags isolated nodes", () => {
    const doc: GraphDocument = {
      version: 1,
      graph: {
        nodes: [
          { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 0 } },
        ],
        edges: [],
      },
    };
    const diags = checkWarnings(doc, defaultRegistry());
    expect(diags.some((d) => d.code === "isolated_node" && d.severity === "warning")).toBe(true);
  });

  it("flags unconnected inputs on connected nodes", () => {
    const doc: GraphDocument = {
      version: 1,
      graph: {
        nodes: [
          { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 0 } },
          { id: 2, type: "Add", position: { x: 0, y: 0 }, parameters: {} },
          { id: 3, type: "Print", position: { x: 0, y: 0 }, parameters: {} },
        ],
        edges: [
          { id: "e1", source: { node: 1, port: "out" }, target: { node: 2, port: "a" } },
          { id: "e2", source: { node: 2, port: "sum" }, target: { node: 3, port: "in" } },
        ],
      },
    };
    const diags = checkWarnings(doc, defaultRegistry());
    expect(diags.some((d) => d.code === "unconnected_input" && d.field === "b")).toBe(true);
  });
});
```

- [ ] **Step 18.2: Run; expect failure.** Module not found.

- [ ] **Step 18.3: Implement `src/validator/rules/warnings.ts`.**

```ts
import type { GraphDocument } from "../../document/types";
import type { Diagnostic } from "../diagnostics";
import type { NodeTypeRegistry } from "../../registry/registry";
import { warning } from "../diagnostics";
import { CODES } from "../codes";

export const checkWarnings = (
  doc: GraphDocument,
  registry: NodeTypeRegistry,
): Diagnostic[] => {
  const out: Diagnostic[] = [];

  const incoming = new Map<number, Set<string>>();
  const outgoing = new Map<number, number>();
  for (const n of doc.graph.nodes) {
    incoming.set(n.id, new Set());
    outgoing.set(n.id, 0);
  }
  for (const e of doc.graph.edges) {
    incoming.get(e.target.node)?.add(e.target.port);
    outgoing.set(e.source.node, (outgoing.get(e.source.node) ?? 0) + 1);
  }

  for (const n of doc.graph.nodes) {
    const inSet = incoming.get(n.id)!;
    const outCount = outgoing.get(n.id)!;
    const isIsolated = inSet.size === 0 && outCount === 0;
    if (isIsolated) {
      out.push(
        warning({
          code: CODES.ISOLATED_NODE,
          message: `Node ${n.id} (${n.type}) is isolated (no edges in or out)`,
          node_id: n.id,
        }),
      );
      continue;
    }
    const desc = registry.get(n.type);
    if (!desc) continue;
    for (const port of desc.inputs) {
      if (!inSet.has(port.name)) {
        out.push(
          warning({
            code: CODES.UNCONNECTED_INPUT,
            message: `Node ${n.id} (${n.type}) input "${port.name}" has no incoming edge`,
            node_id: n.id,
            field: port.name,
          }),
        );
      }
    }
  }
  return out;
};
```

- [ ] **Step 18.4: Run + commit.**

```bash
pnpm test tests/unit/validator/warnings.test.ts && pnpm typecheck
git add src/validator/rules/warnings.ts tests/unit/validator/warnings.test.ts
git commit -m "feat(validator): isolated-node and unconnected-input warnings"
```

---

## Task 19: Validator orchestrator + integration test

**Files:**
- Create: `src/validator/validate.ts`, `src/validator/index.ts`
- Test: `tests/unit/validator/integration.test.ts`

- [ ] **Step 19.1: Implement `src/validator/validate.ts`.**

```ts
import type { GraphDocument } from "../document/types";
import type { Diagnostic } from "./diagnostics";
import { defaultRegistry, type NodeTypeRegistry } from "../registry/registry";
import { checkDuplicateNodeIds } from "./rules/duplicateNodeIds";
import { checkUnknownNodeType } from "./rules/unknownNodeType";
import { checkParameters } from "./rules/parameters";
import { checkEdges } from "./rules/edges";
import { checkPorts } from "./rules/ports";
import { checkFrequency } from "./rules/frequency";
import { checkCycles } from "./rules/cycles";
import { checkWarnings } from "./rules/warnings";

export interface ValidateOptions {
  registry?: NodeTypeRegistry;
}

export const validate = (
  doc: GraphDocument,
  opts: ValidateOptions = {},
): Diagnostic[] => {
  const registry = opts.registry ?? defaultRegistry();
  return [
    ...checkDuplicateNodeIds(doc),
    ...checkUnknownNodeType(doc, registry),
    ...checkParameters(doc, registry),
    ...checkEdges(doc),
    ...checkPorts(doc, registry),
    ...checkFrequency(doc),
    ...checkCycles(doc),
    ...checkWarnings(doc, registry),
  ];
};

export const hasErrors = (diags: readonly Diagnostic[]): boolean =>
  diags.some((d) => d.severity === "error");
```

- [ ] **Step 19.2: Implement `src/validator/index.ts`.**

```ts
export * from "./codes";
export * from "./diagnostics";
export * from "./validate";
```

- [ ] **Step 19.3: Write the integration test.**

`tests/unit/validator/integration.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { validate, hasErrors } from "../../../src/validator";
import type { GraphDocument } from "../../../src/document/types";

const simpleAdd: GraphDocument = {
  version: 1,
  graph: {
    nodes: [
      { id: 1, name: "Two", type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 2 } },
      { id: 2, name: "Three", type: "Constant", position: { x: 200, y: 0 }, parameters: { value: 3 } },
      { id: 3, name: "Adder", type: "Add", position: { x: 400, y: 0 }, parameters: {} },
      { id: 4, name: "Output", type: "Print", position: { x: 600, y: 0 }, parameters: {} },
    ],
    edges: [
      { id: "e1", source: { node: 1, port: "out" }, target: { node: 3, port: "a" } },
      { id: "e2", source: { node: 2, port: "out" }, target: { node: 3, port: "b" } },
      { id: "e3", source: { node: 3, port: "sum" }, target: { node: 4, port: "in" } },
    ],
  },
};

describe("validator integration", () => {
  it("the simple-add fixture has no errors", () => {
    const diags = validate(simpleAdd);
    expect(hasErrors(diags)).toBe(false);
  });

  it("produces every error class for a hand-crafted bad document", () => {
    const bad: GraphDocument = {
      version: 1,
      graph: {
        nodes: [
          { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: {} },
          { id: 1, type: "MysteryNode", position: { x: 0, y: 0 }, parameters: {} },
          { id: 2, type: "Add", position: { x: 0, y: 0 }, parameters: {} },
          { id: 3, type: "Print", position: { x: 0, y: 0 }, parameters: {}, frequency_hz: -1 as unknown as number },
        ],
        edges: [
          { id: "x", source: { node: 1, port: "out" }, target: { node: 2, port: "a" } },
          { id: "x", source: { node: 99, port: "out" }, target: { node: 100, port: "in" } },
          { id: "loop", source: { node: 2, port: "sum" }, target: { node: 2, port: "a" } },
          { id: "bad-port", source: { node: 1, port: "wrong" }, target: { node: 3, port: "wrong" } },
        ],
      },
    };
    const codes = new Set(validate(bad).map((d) => d.code));
    for (const c of [
      "duplicate_node_id",
      "unknown_node_type",
      "missing_required_parameter",
      "invalid_frequency",
      "duplicate_edge_id",
      "missing_source_node",
      "missing_target_node",
      "self_loop",
      "invalid_source_port",
      "invalid_target_port",
    ]) {
      expect(codes, `missing diagnostic ${c}`).toContain(c);
    }
  });
});
```

- [ ] **Step 19.4: Run tests + typecheck.**

Run: `pnpm test tests/unit/validator && pnpm typecheck`
Expected: every validator test passes (including the integration check).

- [ ] **Step 19.5: Commit.**

```bash
git add src/validator/validate.ts src/validator/index.ts tests/unit/validator/integration.test.ts
git commit -m "feat(validator): orchestrator + integration tests"
```

---

## Task 20: Compiler — runtime-bound JSON

**Files:**
- Create: `src/compiler/compile.ts`, `src/compiler/index.ts`
- Test: `tests/unit/compiler/compile.test.ts`

The runtime-bound JSON in v1 is *the canonical `GraphDocument`* re-emitted through validation: validation must succeed (no errors) before the compiler returns output. This is the contract documented in ADR-0001 (compiler emits a stable export shape an external runtime ingests). If validation has errors, compile returns `{success:false, diagnostics}`.

- [ ] **Step 20.1: Write the failing test.**

`tests/unit/compiler/compile.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { compile } from "../../../src/compiler";
import type { GraphDocument } from "../../../src/document/types";

const good: GraphDocument = {
  version: 1,
  graph: {
    nodes: [
      { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 2 } },
      { id: 2, type: "Print", position: { x: 0, y: 0 }, parameters: {} },
    ],
    edges: [
      { id: "e", source: { node: 1, port: "out" }, target: { node: 2, port: "in" } },
    ],
  },
};

describe("compile", () => {
  it("succeeds on a valid graph and returns the document unchanged", () => {
    const r = compile(good);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual(good);
  });

  it("fails on a graph with validation errors", () => {
    const bad: GraphDocument = {
      version: 1,
      graph: {
        nodes: [{ id: 1, type: "MysteryNode", position: { x: 0, y: 0 }, parameters: {} }],
        edges: [],
      },
    };
    const r = compile(bad);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.diagnostics.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 20.2: Run; expect failure.** Module not found.

- [ ] **Step 20.3: Implement `src/compiler/compile.ts`.**

```ts
import type { GraphDocument } from "../document/types";
import type { Diagnostic } from "../validator/diagnostics";
import { validate, hasErrors } from "../validator/validate";
import type { NodeTypeRegistry } from "../registry/registry";

export type CompileResult =
  | { success: true; data: GraphDocument }
  | { success: false; diagnostics: Diagnostic[] };

export const compile = (
  doc: GraphDocument,
  opts: { registry?: NodeTypeRegistry } = {},
): CompileResult => {
  const diagnostics = validate(doc, opts);
  if (hasErrors(diagnostics)) return { success: false, diagnostics };
  return { success: true, data: doc };
};
```

- [ ] **Step 20.4: Implement `src/compiler/index.ts`.**

```ts
export * from "./compile";
```

- [ ] **Step 20.5: Run + commit.**

```bash
pnpm test tests/unit/compiler && pnpm typecheck
git add src/compiler/compile.ts src/compiler/index.ts tests/unit/compiler/compile.test.ts
git commit -m "feat(compiler): GraphDocument -> runtime-bound JSON via validation gate"
```

---

## Task 21: Fixtures + round-trip and prompt-fixture tests

**Files:**
- Create: `fixtures/legacy/simple-add.json`, `fixtures/legacy/parallel-add.json`, `fixtures/versioned/simple-add.json`
- Test: `tests/unit/serializer/roundtrip.test.ts`

- [ ] **Step 21.1: Write `fixtures/legacy/simple-add.json`** (verbatim from prompt §"Simple Add Graph").

```json
{
  "nodes": [
    {"uid": 1, "name": "Two", "type": "Constant", "value": 2},
    {"uid": 2, "name": "Three", "type": "Constant", "value": 3},
    {"uid": 3, "name": "Adder", "type": "Add"},
    {"uid": 4, "name": "Output", "type": "Print"}
  ],
  "edges": [
    {"src": 1, "dst": 3, "port_out": "out", "port_in": "a"},
    {"src": 2, "dst": 3, "port_out": "out", "port_in": "b"},
    {"src": 3, "dst": 4, "port_out": "sum", "port_in": "in"}
  ]
}
```

- [ ] **Step 21.2: Write `fixtures/legacy/parallel-add.json`** (verbatim from prompt §"Parallel Add Graph").

```json
{
  "nodes": [
    {"uid": 1, "type": "Constant", "value": 10},
    {"uid": 2, "type": "Constant", "value": 20},
    {"uid": 3, "type": "Constant", "value": 30},
    {"uid": 4, "type": "Constant", "value": 40},
    {"uid": 5, "name": "Add_Left", "type": "Add"},
    {"uid": 6, "name": "Add_Right", "type": "Add"},
    {"uid": 7, "name": "Add_Final", "type": "Add"},
    {"uid": 8, "type": "Print"}
  ],
  "edges": [
    {"src": 1, "dst": 5, "port_out": "out", "port_in": "a"},
    {"src": 2, "dst": 5, "port_out": "out", "port_in": "b"},
    {"src": 3, "dst": 6, "port_out": "out", "port_in": "a"},
    {"src": 4, "dst": 6, "port_out": "out", "port_in": "b"},
    {"src": 5, "dst": 7, "port_out": "sum", "port_in": "a"},
    {"src": 6, "dst": 7, "port_out": "sum", "port_in": "b"},
    {"src": 7, "dst": 8, "port_out": "sum", "port_in": "in"}
  ]
}
```

- [ ] **Step 21.3: Write `fixtures/versioned/simple-add.json`** (the expected result of loading the legacy simple-add through `loadGraph` and then `saveVersioned`-formatting it). Capture this *after* the round-trip test produces it; for now create with the contents below — the test in Step 21.4 verifies it's exactly correct.

```json
{
  "version": 1,
  "graph": {
    "nodes": [
      {
        "id": 1,
        "name": "Two",
        "type": "Constant",
        "position": { "x": 0, "y": 0 },
        "parameters": { "value": 2 }
      },
      {
        "id": 2,
        "name": "Three",
        "type": "Constant",
        "position": { "x": 200, "y": 0 },
        "parameters": { "value": 3 }
      },
      {
        "id": 3,
        "name": "Adder",
        "type": "Add",
        "position": { "x": 400, "y": 0 },
        "parameters": {}
      },
      {
        "id": 4,
        "name": "Output",
        "type": "Print",
        "position": { "x": 600, "y": 0 },
        "parameters": {}
      }
    ],
    "edges": [
      { "id": "e1_out__3_a", "source": { "node": 1, "port": "out" }, "target": { "node": 3, "port": "a" } },
      { "id": "e2_out__3_b", "source": { "node": 2, "port": "out" }, "target": { "node": 3, "port": "b" } },
      { "id": "e3_sum__4_in", "source": { "node": 3, "port": "sum" }, "target": { "node": 4, "port": "in" } }
    ]
  }
}
```

- [ ] **Step 21.4: Write the round-trip test.**

`tests/unit/serializer/roundtrip.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadGraph, saveVersioned } from "../../../src/serializer";
import { validate, hasErrors } from "../../../src/validator";

const read = (rel: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, "../../../", rel), "utf8")) as unknown;

describe("legacy fixtures round-trip", () => {
  it("simple-add legacy loads, validates clean, and matches versioned fixture", () => {
    const legacy = loadGraph(read("fixtures/legacy/simple-add.json"));
    expect(legacy.success).toBe(true);
    if (!legacy.success) return;

    expect(hasErrors(validate(legacy.data))).toBe(false);

    const expected = read("fixtures/versioned/simple-add.json");
    expect(JSON.parse(saveVersioned(legacy.data))).toEqual(expected);
  });

  it("parallel-add legacy loads and validates clean", () => {
    const r = loadGraph(read("fixtures/legacy/parallel-add.json"));
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(hasErrors(validate(r.data))).toBe(false);
  });
});
```

- [ ] **Step 21.5: Run tests + typecheck.**

Run: `pnpm test && pnpm typecheck`
Expected: every Phase 1 test passes.

If the simple-add round-trip mismatches the committed `fixtures/versioned/simple-add.json` (e.g., key order differs), update the fixture to match the actual `saveVersioned` output and re-run. The expected output is the source of truth; the fixture is regenerated from it.

- [ ] **Step 21.6: Commit.**

```bash
git add fixtures tests/unit/serializer/roundtrip.test.ts
git commit -m "test(serializer): prompt fixtures + round-trip assertions"
```

---

## Task 22: CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 22.1: Write `.github/workflows/ci.yml`.**

```yaml
name: CI

on:
  push:
    branches: [master, main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm format:check
      - run: pnpm typecheck
      - run: pnpm test
```

- [ ] **Step 22.2: Commit.**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: lint, format, typecheck, test on push and pr"
```

---

## Task 23: Phase 1 close

- [ ] **Step 23.1: Update `CHANGELOG.md`** (append under `[Unreleased]`):

```markdown
### Phase 1 — Schema & Runtime Adapter (complete, YYYY-MM-DD)
- Project scaffolded with TypeScript strict, Vitest, ESLint, Prettier.
- `GraphDocument`, `NodeTypeDescription`, and `Diagnostic` modeled with Zod.
- Built-in registry for `Constant` / `Add` / `Print`.
- Versioned and legacy serializers with auto-detect dispatch.
- Validator with eight rule modules covering every error and warning class
  defined in the spec; reserved `frequency_for_missing_node` code unused
  while frequency stays a per-node field.
- Compiler emits the canonical JSON when validation passes.
- Prompt fixtures (simple-add, parallel-add) load, validate, and round-trip.
- CI workflow on GitHub Actions.
```

Replace `YYYY-MM-DD` with the date of completion.

- [ ] **Step 23.2: Update `PLAN.md`** — tick all Phase 1 boxes; flip `Active phase` to `Phase 2 — Minimal Visual Editor`.

- [ ] **Step 23.3: Update `PROJECT_MEMORY.md`** — change `Current phase` to `Phase 2 — Minimal Visual Editor`. Append to *Environment notes* if anything changed during install (e.g., locked Node 22.x.y, pnpm 10.x.y, zod 4.x.y, vitest 4.x.y, typescript 6.x.y).

- [ ] **Step 23.4: Final green check.**

Run: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`
Expected: every command exits 0.

- [ ] **Step 23.5: Tag and commit.**

```bash
git add CHANGELOG.md PLAN.md PROJECT_MEMORY.md
git commit -m "docs: close phase 1 — schema and runtime adapter"
git tag phase-1-complete
```

---

## Self-review

- [x] Spec coverage — every subsystem in `docs/specs/2026-05-01-n8n-port-editor-design.md` §6 (schemas), §7 (built-ins), §8 (validator rules), §10 (persistence — only the loader half here; saver is just `saveVersioned`), and §13 (test strategy: unit) is touched by a task. Phase-1 scope is non-UI; Phases 2–4 cover the rest.
- [x] Placeholder scan — no "TBD/TODO/implement later/handle edge cases" in any step. Tests show real assertions; commands are concrete.
- [x] Type consistency — `GraphDocument`, `Diagnostic`, `NodeTypeDescription`, `LoadResult`, `CompileResult`, `NodeTypeRegistry` all have a single source-of-truth task and are referenced by the same name everywhere.
- [x] Reserved `frequency_for_missing_node` code is documented as intentionally unused in this phase (Task 16 commit message).
- [x] Versioned fixture in Task 21 may need a one-line regeneration if `saveVersioned` produces a different key order than written; the step explicitly handles that.

---

## Open carry-forwards into Phase 2+

- Live debounced validation, CLI bundle, and registry public registration API stay in §17 of the design spec — out of scope for Phase 1.
- Vue / Vue Flow / Pinia / Vite are not installed in Phase 1; they arrive in Phase 2.
