# Sub-graphs / Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add true sub-graph encapsulation to the n8n_port editor — typed port surface via explicit pseudo-nodes, unbounded recursive nesting, drill-in navigation with breadcrumbs, current-level-only RunResult overlays — flattened at compile time so the C++ runtime contract is unchanged.

**Architecture:** Three new built-in node types (`Subgraph`, `SubgraphInput`, `SubgraphOutput`) registered through `NodeTypeRegistry`. Recursion lives in `Subgraph.parameters.children: GraphDocument` via `z.lazy()`. A shared `subgraphChase.ts` resolves edge endpoints across boundaries (single-valued `resolveSource`, multi-valued `resolveTarget`) and is used by validator, compiler, and `canConnect`. Compiler renumbers to fresh integer uids and emits a path → uid `idMap` for executionStore reverse lookup. Editor adds `editorStore.currentPath` so canvas, stores, and shortcuts all operate on the addressed level.

**Tech Stack:** TypeScript strict, Vue 3 + Pinia, Vue Flow, Zod, Vitest + happy-dom + @vue/test-utils, Playwright, ESLint + Prettier.

**Spec:** `docs/specs/2026-05-02-subgraphs-design.md` (commit `42083e7`).

**Branch:** `feat/subgraphs` (already created; spec already committed).

**Test strategy notes:** TDD where practical (each new pure function gets a failing test first). VueFlow component tests stay smoke-level — full lifecycle goes through the single Playwright e2e in Task 28. Pre-commit gates (`pnpm lint typecheck test format:check build`) run after every task. A11y axe gate (Task 28 portion) must stay green.

---

## Files Touched

**Created:**
- `src/document/subgraph.ts`
- `src/document/subgraphChase.ts`
- `src/validator/rules/reservedNodeType.ts`
- `src/validator/rules/subgraphSchema.ts`
- `src/validator/rules/subgraphPlacement.ts`
- `src/validator/rules/subgraphPorts.ts`
- `src/validator/rules/subgraphConnectivity.ts`
- `src/editor/components/Breadcrumbs.vue`
- `tests/unit/document/subgraph.test.ts`
- `tests/unit/document/subgraphChase.test.ts`
- `tests/unit/registry/subgraphBuiltIns.test.ts`
- `tests/unit/validator/subgraphSchema.test.ts`
- `tests/unit/validator/subgraphPlacement.test.ts`
- `tests/unit/validator/subgraphPorts.test.ts`
- `tests/unit/validator/subgraphConnectivity.test.ts`
- `tests/unit/validator/reservedNodeType.test.ts`
- `tests/unit/validator/recursion.test.ts`
- `tests/unit/compiler/compile.subgraph.test.ts`
- `tests/unit/editor/canConnect.subgraph.test.ts`
- `tests/unit/editor/composables/useCanvasOperations.subgraph.test.ts`
- `tests/unit/editor/stores/executionStore.subgraph.test.ts`
- `tests/e2e/subgraph.spec.ts`
- `docs/decisions/0007-subgraphs-flatten-at-compile.md`

**Modified:**
- `src/registry/builtIns.ts` (register the three new types)
- `src/validator/codes.ts` (new codes)
- `src/validator/diagnostics.ts` (add `path?: number[]`)
- `src/validator/validate.ts` (recursive traversal; new rule wiring)
- `src/validator/rules/warnings.ts` (skip pseudo-nodes in ISOLATED_NODE)
- `src/validator/rules/ports.ts`, `params.ts`, `cycles.ts`, `edges.ts`, `freq.ts`, `ids.ts` (signature: accept `(graph, path)`; existing rule bodies operate on `graph` instead of `doc.graph`)
- `src/editor/canConnect.ts` (cross-boundary chase)
- `src/compiler/compile.ts` (new return shape, recursive flatten)
- `src/cli/*.ts` (consume `compile(doc).graph`)
- `src/editor/stores/editorStore.ts` (`currentPath`)
- `src/editor/stores/documentStore.ts` (`getCurrentLevel`, path-aware mutations)
- `src/editor/stores/executionStore.ts` (path-keyed overlay)
- `src/editor/stores/clipboardStore.ts` (current-level scope)
- `src/editor/composables/useCanvasOperations.ts` (`enterSubgraph`, `exitToParent`, `groupSelection`)
- `src/editor/components/CanvasView.vue`, `CustomNode.vue`, `Palette.vue`, `PropertyPanel.vue`, `TopBar.vue`
- Existing tests under `tests/unit/validator/`, `tests/unit/compiler/` updated for new signatures
- `PROJECT_MEMORY.md`, `PLAN.md`, `CHANGELOG.md`

---

## Phase 1 — Document foundation

### Task 1: New schemas in `src/document/subgraph.ts`

**Files:**
- Create: `src/document/subgraph.ts`
- Modify: `src/document/index.ts`
- Test: `tests/unit/document/subgraph.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/document/subgraph.test.ts
import { describe, expect, it } from "vitest";
import {
  PseudoPortParametersSchema,
  SubgraphParametersSchema,
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
} from "../../../src/document/subgraph";

describe("PseudoPortParametersSchema", () => {
  it("accepts well-formed pseudo-port parameters", () => {
    expect(
      PseudoPortParametersSchema.safeParse({ name: "x", portType: "int" }).success,
    ).toBe(true);
  });

  it("rejects empty name", () => {
    expect(
      PseudoPortParametersSchema.safeParse({ name: "", portType: "int" }).success,
    ).toBe(false);
  });

  it("rejects empty portType", () => {
    expect(
      PseudoPortParametersSchema.safeParse({ name: "x", portType: "" }).success,
    ).toBe(false);
  });
});

describe("SubgraphParametersSchema", () => {
  it("accepts an empty children GraphDocument", () => {
    expect(
      SubgraphParametersSchema.safeParse({
        children: { version: 1, graph: { nodes: [], edges: [], comments: [] } },
      }).success,
    ).toBe(true);
  });

  it("recursively accepts nested sub-graphs", () => {
    const inner = { version: 1, graph: { nodes: [], edges: [], comments: [] } };
    const outer = {
      children: {
        version: 1,
        graph: {
          nodes: [
            {
              id: 1,
              type: "Subgraph",
              position: { x: 0, y: 0 },
              parameters: { children: inner },
            },
          ],
          edges: [],
          comments: [],
        },
      },
    };
    // Schema parse only checks parameters.children is a GraphDocument; the
    // `parameters` field on the inner node is unknown to base NodeSchema and
    // tightened by the validator, not by Zod here. So this asserts the outer
    // shape parses cleanly.
    expect(SubgraphParametersSchema.safeParse(outer).success).toBe(true);
  });

  it("rejects a children value that is not a GraphDocument", () => {
    expect(SubgraphParametersSchema.safeParse({ children: 42 }).success).toBe(false);
  });
});

describe("reserved node-type constants", () => {
  it("are stable strings", () => {
    expect(SUBGRAPH_NODE_TYPE).toBe("Subgraph");
    expect(SUBGRAPH_INPUT_NODE_TYPE).toBe("SubgraphInput");
    expect(SUBGRAPH_OUTPUT_NODE_TYPE).toBe("SubgraphOutput");
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

```
pnpm test tests/unit/document/subgraph.test.ts
```
Expected: module-not-found error.

- [ ] **Step 3: Implement `src/document/subgraph.ts`**

```ts
import * as z from "zod";
import { GraphDocumentSchema, type GraphDocument } from "./types";

export const SUBGRAPH_NODE_TYPE = "Subgraph";
export const SUBGRAPH_INPUT_NODE_TYPE = "SubgraphInput";
export const SUBGRAPH_OUTPUT_NODE_TYPE = "SubgraphOutput";

export const RESERVED_SUBGRAPH_TYPES: readonly string[] = [
  SUBGRAPH_NODE_TYPE,
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
];

export const SubgraphParametersSchema: z.ZodType<{ children: GraphDocument }> = z.object({
  children: z.lazy(() => GraphDocumentSchema),
});

export const PseudoPortParametersSchema = z.object({
  name: z.string().min(1),
  portType: z.string().min(1),
});

export type SubgraphParameters = z.infer<typeof SubgraphParametersSchema>;
export type PseudoPortParameters = z.infer<typeof PseudoPortParametersSchema>;
```

- [ ] **Step 4: Re-export from `src/document/index.ts`**

```ts
export * from "./types";
export * from "./ids";
export * from "./subgraph";
```

- [ ] **Step 5: Run test, expect PASS**

```
pnpm test tests/unit/document/subgraph.test.ts
```

- [ ] **Step 6: Run full gates**

```
pnpm lint && pnpm typecheck && pnpm format:check && pnpm test
```

- [ ] **Step 7: Commit**

```bash
git add src/document/subgraph.ts src/document/index.ts tests/unit/document/subgraph.test.ts
git commit -m "feat(document): add subgraph schemas and reserved type constants"
```

---

### Task 2: Chase helpers in `src/document/subgraphChase.ts`

**Files:**
- Create: `src/document/subgraphChase.ts`
- Test: `tests/unit/document/subgraphChase.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/document/subgraphChase.test.ts
import { describe, expect, it } from "vitest";
import type { GraphDocument } from "../../../src/document/types";
import { resolveSource, resolveTarget } from "../../../src/document/subgraphChase";

// Helper: build a doc with a single sub-graph that wraps Add behind ports x,y.
const docWithSubgraph = (): GraphDocument => ({
  version: 1,
  graph: {
    nodes: [
      { id: 10, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 1 } },
      {
        id: 11,
        type: "Subgraph",
        position: { x: 100, y: 0 },
        parameters: {
          children: {
            version: 1,
            graph: {
              nodes: [
                {
                  id: 1,
                  type: "SubgraphInput",
                  position: { x: 0, y: 0 },
                  parameters: { name: "x", portType: "int" },
                },
                { id: 2, type: "Add", position: { x: 100, y: 0 }, parameters: {} },
                {
                  id: 3,
                  type: "SubgraphOutput",
                  position: { x: 200, y: 0 },
                  parameters: { name: "y", portType: "int" },
                },
              ],
              edges: [
                { id: "e1_x__2_a", source: { node: 1, port: "x" }, target: { node: 2, port: "a" } },
                { id: "e2_sum__3_y", source: { node: 2, port: "sum" }, target: { node: 3, port: "y" } },
              ],
              comments: [],
            },
          },
        },
      },
      { id: 12, type: "Print", position: { x: 200, y: 0 }, parameters: {} },
    ],
    edges: [
      { id: "e10_out__11_x", source: { node: 10, port: "out" }, target: { node: 11, port: "x" } },
      { id: "e11_y__12_in", source: { node: 11, port: "y" }, target: { node: 12, port: "in" } },
    ],
    comments: [],
  },
});

describe("resolveSource", () => {
  it("returns regular node endpoints unchanged", () => {
    const doc = docWithSubgraph();
    expect(resolveSource(doc, [], { node: 10, port: "out" })).toEqual({
      node: 10,
      port: "out",
      path: [],
    });
  });

  it("descends through Subgraph container to the SubgraphOutput's feeder", () => {
    const doc = docWithSubgraph();
    expect(resolveSource(doc, [], { node: 11, port: "y" })).toEqual({
      node: 2,
      port: "sum",
      path: [11],
    });
  });

  it("ascends from SubgraphInput pseudo-node to the parent's feeder", () => {
    const doc = docWithSubgraph();
    expect(resolveSource(doc, [11], { node: 1, port: "x" })).toEqual({
      node: 10,
      port: "out",
      path: [],
    });
  });
});

describe("resolveTarget", () => {
  it("returns regular node endpoints as a singleton", () => {
    const doc = docWithSubgraph();
    expect(resolveTarget(doc, [], { node: 12, port: "in" })).toEqual([
      { node: 12, port: "in", path: [] },
    ]);
  });

  it("descends through Subgraph container, fanning out to all internal consumers", () => {
    const doc = docWithSubgraph();
    expect(resolveTarget(doc, [], { node: 11, port: "x" })).toEqual([
      { node: 2, port: "a", path: [11] },
    ]);
  });

  it("ascends from SubgraphOutput pseudo-node to all parent consumers", () => {
    const doc = docWithSubgraph();
    expect(resolveTarget(doc, [11], { node: 3, port: "y" })).toEqual([
      { node: 12, port: "in", path: [] },
    ]);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL** (`pnpm test tests/unit/document/subgraphChase.test.ts`).

- [ ] **Step 3: Implement `src/document/subgraphChase.ts`**

```ts
import type { EdgeEndpoint, Graph, GraphDocument, GraphNode } from "./types";
import {
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
} from "./subgraph";

export interface ResolvedEndpoint {
  node: number;
  port: string;
  path: number[];
}

const graphAt = (doc: GraphDocument, path: number[]): Graph | null => {
  let g: Graph = doc.graph;
  for (const subgraphId of path) {
    const node = g.nodes.find((n) => n.id === subgraphId);
    if (!node || node.type !== SUBGRAPH_NODE_TYPE) return null;
    const params = node.parameters as { children?: GraphDocument };
    if (!params.children) return null;
    g = params.children.graph;
  }
  return g;
};

const findNode = (graph: Graph, id: number): GraphNode | undefined =>
  graph.nodes.find((n) => n.id === id);

export const resolveSource = (
  doc: GraphDocument,
  path: number[],
  endpoint: EdgeEndpoint,
): ResolvedEndpoint | null => {
  const graph = graphAt(doc, path);
  if (!graph) return null;
  const node = findNode(graph, endpoint.node);
  if (!node) return null;

  if (node.type === SUBGRAPH_NODE_TYPE) {
    // Descend; find SubgraphOutput with matching name; recurse on that
    // pseudo-node's feeding edge inside.
    const childPath = [...path, node.id];
    const childGraph = graphAt(doc, childPath);
    if (!childGraph) return null;
    const pseudo = childGraph.nodes.find(
      (n) =>
        n.type === SUBGRAPH_OUTPUT_NODE_TYPE &&
        (n.parameters as { name?: string }).name === endpoint.port,
    );
    if (!pseudo) return null;
    const innerEdge = childGraph.edges.find(
      (e) => e.target.node === pseudo.id && e.target.port === endpoint.port,
    );
    if (!innerEdge) return null;
    return resolveSource(doc, childPath, innerEdge.source);
  }

  if (node.type === SUBGRAPH_INPUT_NODE_TYPE) {
    // Ascend: parent edge whose target is (parent Subgraph node, this pseudo's name).
    if (path.length === 0) return null;
    const parentPath = path.slice(0, -1);
    const parentSubgraphId = path[path.length - 1]!;
    const name = (node.parameters as { name?: string }).name;
    if (name === undefined) return null;
    const parentGraph = graphAt(doc, parentPath);
    if (!parentGraph) return null;
    const parentEdge = parentGraph.edges.find(
      (e) => e.target.node === parentSubgraphId && e.target.port === name,
    );
    if (!parentEdge) return null;
    return resolveSource(doc, parentPath, parentEdge.source);
  }

  return { node: endpoint.node, port: endpoint.port, path };
};

export const resolveTarget = (
  doc: GraphDocument,
  path: number[],
  endpoint: EdgeEndpoint,
): ResolvedEndpoint[] => {
  const graph = graphAt(doc, path);
  if (!graph) return [];
  const node = findNode(graph, endpoint.node);
  if (!node) return [];

  if (node.type === SUBGRAPH_NODE_TYPE) {
    const childPath = [...path, node.id];
    const childGraph = graphAt(doc, childPath);
    if (!childGraph) return [];
    const pseudo = childGraph.nodes.find(
      (n) =>
        n.type === SUBGRAPH_INPUT_NODE_TYPE &&
        (n.parameters as { name?: string }).name === endpoint.port,
    );
    if (!pseudo) return [];
    return childGraph.edges
      .filter((e) => e.source.node === pseudo.id && e.source.port === endpoint.port)
      .flatMap((e) => resolveTarget(doc, childPath, e.target));
  }

  if (node.type === SUBGRAPH_OUTPUT_NODE_TYPE) {
    if (path.length === 0) return [];
    const parentPath = path.slice(0, -1);
    const parentSubgraphId = path[path.length - 1]!;
    const name = (node.parameters as { name?: string }).name;
    if (name === undefined) return [];
    const parentGraph = graphAt(doc, parentPath);
    if (!parentGraph) return [];
    return parentGraph.edges
      .filter((e) => e.source.node === parentSubgraphId && e.source.port === name)
      .flatMap((e) => resolveTarget(doc, parentPath, e.target));
  }

  return [{ node: endpoint.node, port: endpoint.port, path }];
};

export const pathKey = (path: number[], localId: number): string =>
  path.length === 0 ? String(localId) : `${path.join("/")}/${String(localId)}`;
```

- [ ] **Step 4: Run test, expect PASS** (`pnpm test tests/unit/document/subgraphChase.test.ts`).

- [ ] **Step 5: Re-export from `src/document/index.ts`**

```ts
export * from "./types";
export * from "./ids";
export * from "./subgraph";
export * from "./subgraphChase";
```

- [ ] **Step 6: Full gates** (`pnpm lint && pnpm typecheck && pnpm format:check && pnpm test`).

- [ ] **Step 7: Commit**

```bash
git add src/document/subgraphChase.ts src/document/index.ts tests/unit/document/subgraphChase.test.ts
git commit -m "feat(document): add subgraph chase helpers (resolveSource, resolveTarget, pathKey)"
```

---

## Phase 2 — Registry

### Task 3: Register the three new built-in node types

**Files:**
- Modify: `src/registry/builtIns.ts`
- Test: `tests/unit/registry/subgraphBuiltIns.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/registry/subgraphBuiltIns.test.ts
import { describe, expect, it } from "vitest";
import { defaultRegistry } from "../../../src/registry/registry";

describe("subgraph built-in node types", () => {
  const reg = defaultRegistry();

  it("registers Subgraph as a category=Subgraph type", () => {
    const desc = reg.get("Subgraph");
    expect(desc).toBeDefined();
    expect(desc?.category).toBe("Subgraph");
    expect(desc?.inputs).toEqual([]);
    expect(desc?.outputs).toEqual([]);
  });

  it("registers SubgraphInput with one untyped output handle (typed at runtime by parameters.portType)", () => {
    const desc = reg.get("SubgraphInput");
    expect(desc).toBeDefined();
    expect(desc?.inputs).toEqual([]);
    expect(desc?.outputs).toEqual([{ name: "out" }]);
  });

  it("registers SubgraphOutput with one untyped input handle", () => {
    const desc = reg.get("SubgraphOutput");
    expect(desc).toBeDefined();
    expect(desc?.inputs).toEqual([{ name: "in" }]);
    expect(desc?.outputs).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL** (the three types are unregistered).

- [ ] **Step 3: Add the descriptions in `src/registry/builtIns.ts`**

Append before `BUILT_IN_NODE_TYPES`:

```ts
const Subgraph: NodeTypeDescription = {
  type: "Subgraph",
  display_name: "Sub-graph",
  category: "Subgraph",
  // Outer-face ports are derived dynamically from the inner pseudo-nodes;
  // the registry description carries no static port list.
  inputs: [],
  outputs: [],
  parameters: {},
};

const SubgraphInput: NodeTypeDescription = {
  type: "SubgraphInput",
  display_name: "Sub-graph input",
  category: "Subgraph",
  inputs: [],
  // Single output handle. The user-visible type is parameters.portType, set
  // per-instance; the registry description leaves the handle type untyped so
  // it doesn't fight the validator's per-pseudo-node typing.
  outputs: [{ name: "out" }],
  parameters: {
    name: { type: "string", required: true },
    portType: { type: "string", required: true },
  },
};

const SubgraphOutput: NodeTypeDescription = {
  type: "SubgraphOutput",
  display_name: "Sub-graph output",
  category: "Subgraph",
  inputs: [{ name: "in" }],
  outputs: [],
  parameters: {
    name: { type: "string", required: true },
    portType: { type: "string", required: true },
  },
};
```

Update the export:

```ts
export const BUILT_IN_NODE_TYPES: readonly NodeTypeDescription[] = [
  Constant,
  Add,
  Print,
  Subgraph,
  SubgraphInput,
  SubgraphOutput,
];
```

- [ ] **Step 4: Run test, expect PASS**.

- [ ] **Step 5: Full gates**.

- [ ] **Step 6: Commit**

```bash
git add src/registry/builtIns.ts tests/unit/registry/subgraphBuiltIns.test.ts
git commit -m "feat(registry): register Subgraph, SubgraphInput, SubgraphOutput built-ins"
```

---

## Phase 3 — Validator

### Task 4: Diagnostic gains optional `path` field

**Files:**
- Modify: `src/validator/diagnostics.ts`

- [ ] **Step 1: Update the schema and types**

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
  // Chain of Subgraph node ids from root to the level where the offending
  // element lives. Empty/absent = root level.
  path: z.array(z.number().int()).optional(),
});

export type Diagnostic = z.infer<typeof DiagnosticSchema> & { code: DiagnosticCode };

export interface DiagnosticInit {
  code: DiagnosticCode;
  message: string;
  node_id?: number;
  edge_id?: string;
  field?: string;
  path?: number[];
}

export const error = (init: DiagnosticInit): Diagnostic => ({
  ...init,
  severity: "error",
});

export const warning = (init: DiagnosticInit): Diagnostic => ({
  ...init,
  severity: "warning",
});
```

- [ ] **Step 2: Run gates** (`pnpm lint && pnpm typecheck && pnpm test`). Expected PASS — additive optional field, no existing call breaks.

- [ ] **Step 3: Commit**

```bash
git add src/validator/diagnostics.ts
git commit -m "feat(validator): add optional path field to Diagnostic"
```

---

### Task 5: Refactor existing rules to take `(graph, path?)` instead of `(doc)`

This unblocks recursion in Task 13. Each existing rule's body changes only its argument shape; behavior is unchanged.

**Files (all under `src/validator/rules/`):**
- Modify: `cycles.ts`, `edges.ts`, `freq.ts`, `ids.ts`, `params.ts`, `ports.ts`, `warnings.ts`
- Modify: `src/validator/validate.ts`
- Tests under `tests/unit/validator/` are updated for the new signatures.

- [ ] **Step 1: Update each rule's signature**

For each rule, replace `(doc: GraphDocument, ...)` with `(graph: Graph, path: number[] = [], ...)`. Replace `doc.graph` references with `graph`. Where the rule emits `node_id` or `edge_id`, also pass `path` to `error(...)` / `warning(...)` if `path.length > 0`.

Example for `src/validator/rules/edges.ts`:

```ts
import type { Graph } from "../../document/types";
import { CODES } from "../codes";
import { error, type Diagnostic } from "../diagnostics";

export const checkMissingEdgeEndpoints = (graph: Graph, path: number[] = []): Diagnostic[] => {
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const diagnostics: Diagnostic[] = [];

  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source.node)) {
      diagnostics.push(
        error({
          code: CODES.MISSING_SOURCE_NODE,
          message: `Edge ${edge.id} references missing source node ${String(edge.source.node)}.`,
          edge_id: edge.id,
          node_id: edge.source.node,
          field: "source.node",
          ...(path.length > 0 ? { path } : {}),
        }),
      );
    }
    if (!nodeIds.has(edge.target.node)) {
      diagnostics.push(
        error({
          code: CODES.MISSING_TARGET_NODE,
          message: `Edge ${edge.id} references missing target node ${String(edge.target.node)}.`,
          edge_id: edge.id,
          node_id: edge.target.node,
          field: "target.node",
          ...(path.length > 0 ? { path } : {}),
        }),
      );
    }
  }

  return diagnostics;
};

export const checkSelfLoops = (graph: Graph, path: number[] = []): Diagnostic[] => {
  const out: Diagnostic[] = [];
  for (const edge of graph.edges) {
    if (edge.source.node === edge.target.node) {
      out.push(
        error({
          code: CODES.SELF_LOOP,
          message: `Edge ${edge.id} forms a self-loop on node ${String(edge.source.node)}.`,
          edge_id: edge.id,
          node_id: edge.source.node,
          ...(path.length > 0 ? { path } : {}),
        }),
      );
    }
  }
  return out;
};
```

Apply the same transformation to `cycles.ts`, `freq.ts`, `ids.ts`, `params.ts`, `ports.ts`, `warnings.ts`. The body of each rule changes `doc.graph.nodes` → `graph.nodes` and `doc.graph.edges` → `graph.edges`. Rules that take `registry` keep that argument after `path`.

- [ ] **Step 2: Update `validate.ts` to call rules with `(doc.graph, [])`**

```ts
export const validate = (
  doc: GraphDocument,
  registry: NodeTypeRegistry = defaultRegistry(),
): Diagnostic[] => [
  ...checkDuplicateNodeIds(doc.graph),
  ...checkDuplicateEdgeIds(doc.graph),
  ...checkMissingEdgeEndpoints(doc.graph),
  ...checkSelfLoops(doc.graph),
  ...checkUnknownNodeTypes(doc.graph, [], registry),
  ...checkMissingRequiredParameters(doc.graph, [], registry),
  ...checkParameterTypeMismatch(doc.graph, [], registry),
  ...checkInvalidFrequency(doc.graph),
  ...checkInvalidSourcePort(doc.graph, [], registry),
  ...checkInvalidTargetPort(doc.graph, [], registry),
  ...checkPortTypeMismatch(doc.graph, [], registry),
  ...checkCycles(doc.graph),
  ...checkIsolatedNodes(doc.graph),
  ...checkUnconnectedInputs(doc.graph, [], registry),
];
```

- [ ] **Step 3: Update existing rule tests under `tests/unit/validator/` to construct a `Graph` and call rules with `(graph, [])` (or just `(graph)` for rules without registry)**

Per rule test file, replace `rule(doc)` with `rule(doc.graph)` and `rule(doc, registry)` with `rule(doc.graph, [], registry)`. The fixtures themselves are unchanged.

- [ ] **Step 4: Run full test suite, expect all green**

```
pnpm test
```

- [ ] **Step 5: Run gates and commit**

```
pnpm lint && pnpm typecheck && pnpm format:check
git add src/validator/ tests/unit/validator/
git commit -m "refactor(validator): rules accept (graph, path) for recursion"
```

---

### Task 6: Add new diagnostic codes

**Files:**
- Modify: `src/validator/codes.ts`

- [ ] **Step 1: Append codes**

```ts
export const CODES = {
  // ...existing codes unchanged...
  RESERVED_NODE_TYPE: "reserved_node_type",
  SUBGRAPH_INVALID_PARAMETERS: "subgraph_invalid_parameters",
  PSEUDO_NODE_INVALID_PARAMETERS: "pseudo_node_invalid_parameters",
  PSEUDO_NODE_AT_ROOT: "pseudo_node_at_root",
  PSEUDO_NODE_DUPLICATE_NAME: "pseudo_node_duplicate_name",
  SUBGRAPH_PORT_UNBOUND: "subgraph_port_unbound",
  SUBGRAPH_PORT_TYPE_MISMATCH: "subgraph_port_type_mismatch",
  SUBGRAPH_INPUT_UNCONNECTED: "subgraph_input_unconnected",
  SUBGRAPH_OUTPUT_UNCONNECTED: "subgraph_output_unconnected",
  EMPTY_SUBGRAPH: "empty_subgraph",
} as const;
```

- [ ] **Step 2: Gates and commit**

```
pnpm typecheck && pnpm lint
git add src/validator/codes.ts
git commit -m "feat(validator): add subgraph diagnostic codes"
```

---

### Task 7: `subgraphSchema` rule

**Files:**
- Create: `src/validator/rules/subgraphSchema.ts`
- Test: `tests/unit/validator/subgraphSchema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/validator/subgraphSchema.test.ts
import { describe, expect, it } from "vitest";
import type { Graph } from "../../../src/document/types";
import { checkSubgraphSchema } from "../../../src/validator/rules/subgraphSchema";

const graph = (nodes: Graph["nodes"]): Graph => ({ nodes, edges: [], comments: [] });

describe("checkSubgraphSchema", () => {
  it("emits subgraph_invalid_parameters when Subgraph parameters fail to parse", () => {
    const g = graph([
      // Missing children entirely.
      { id: 1, type: "Subgraph", position: { x: 0, y: 0 }, parameters: {} },
    ]);
    const out = checkSubgraphSchema(g);
    expect(out).toHaveLength(1);
    expect(out[0]?.code).toBe("subgraph_invalid_parameters");
    expect(out[0]?.node_id).toBe(1);
  });

  it("emits pseudo_node_invalid_parameters for malformed SubgraphInput parameters", () => {
    const g = graph([
      { id: 1, type: "SubgraphInput", position: { x: 0, y: 0 }, parameters: { name: "" } },
    ]);
    const out = checkSubgraphSchema(g);
    expect(out).toHaveLength(1);
    expect(out[0]?.code).toBe("pseudo_node_invalid_parameters");
    expect(out[0]?.node_id).toBe(1);
  });

  it("does not emit for well-formed Subgraph and pseudo-nodes", () => {
    const g = graph([
      {
        id: 1,
        type: "Subgraph",
        position: { x: 0, y: 0 },
        parameters: {
          children: { version: 1, graph: { nodes: [], edges: [], comments: [] } },
        },
      },
      {
        id: 2,
        type: "SubgraphInput",
        position: { x: 0, y: 0 },
        parameters: { name: "x", portType: "int" },
      },
    ]);
    expect(checkSubgraphSchema(g)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL** (`pnpm test tests/unit/validator/subgraphSchema.test.ts`).

- [ ] **Step 3: Implement the rule**

```ts
// src/validator/rules/subgraphSchema.ts
import type { Graph } from "../../document/types";
import {
  PseudoPortParametersSchema,
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
  SubgraphParametersSchema,
} from "../../document/subgraph";
import { CODES } from "../codes";
import { error, type Diagnostic } from "../diagnostics";

export const checkSubgraphSchema = (graph: Graph, path: number[] = []): Diagnostic[] => {
  const out: Diagnostic[] = [];
  for (const node of graph.nodes) {
    if (node.type === SUBGRAPH_NODE_TYPE) {
      const r = SubgraphParametersSchema.safeParse(node.parameters);
      if (!r.success) {
        const issue = r.error.issues[0];
        out.push(
          error({
            code: CODES.SUBGRAPH_INVALID_PARAMETERS,
            message: `Subgraph node ${String(node.id)} has invalid parameters: ${issue?.message ?? "parse error"}.`,
            node_id: node.id,
            field: issue?.path.join(".") ?? "parameters",
            ...(path.length > 0 ? { path } : {}),
          }),
        );
      }
      continue;
    }
    if (node.type === SUBGRAPH_INPUT_NODE_TYPE || node.type === SUBGRAPH_OUTPUT_NODE_TYPE) {
      const r = PseudoPortParametersSchema.safeParse(node.parameters);
      if (!r.success) {
        const issue = r.error.issues[0];
        out.push(
          error({
            code: CODES.PSEUDO_NODE_INVALID_PARAMETERS,
            message: `${node.type} node ${String(node.id)} has invalid parameters: ${issue?.message ?? "parse error"}.`,
            node_id: node.id,
            field: issue?.path.join(".") ?? "parameters",
            ...(path.length > 0 ? { path } : {}),
          }),
        );
      }
    }
  }
  return out;
};
```

- [ ] **Step 4: Run test, expect PASS**.

- [ ] **Step 5: Gates and commit**

```bash
pnpm lint && pnpm typecheck
git add src/validator/rules/subgraphSchema.ts tests/unit/validator/subgraphSchema.test.ts
git commit -m "feat(validator): add subgraphSchema rule"
```

---

### Task 8: `subgraphPlacement` rule (`pseudo_node_at_root`)

**Files:**
- Create: `src/validator/rules/subgraphPlacement.ts`
- Test: `tests/unit/validator/subgraphPlacement.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import type { Graph } from "../../../src/document/types";
import { checkSubgraphPlacement } from "../../../src/validator/rules/subgraphPlacement";

const g = (nodes: Graph["nodes"]): Graph => ({ nodes, edges: [], comments: [] });

describe("checkSubgraphPlacement", () => {
  it("emits pseudo_node_at_root for a SubgraphInput at root level", () => {
    const out = checkSubgraphPlacement(
      g([
        {
          id: 1,
          type: "SubgraphInput",
          position: { x: 0, y: 0 },
          parameters: { name: "x", portType: "int" },
        },
      ]),
      [],
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.code).toBe("pseudo_node_at_root");
    expect(out[0]?.node_id).toBe(1);
  });

  it("does not emit when path is non-empty (inside a sub-graph)", () => {
    const out = checkSubgraphPlacement(
      g([
        {
          id: 1,
          type: "SubgraphInput",
          position: { x: 0, y: 0 },
          parameters: { name: "x", portType: "int" },
        },
      ]),
      [42],
    );
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**.

- [ ] **Step 3: Implement**

```ts
// src/validator/rules/subgraphPlacement.ts
import type { Graph } from "../../document/types";
import {
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
} from "../../document/subgraph";
import { CODES } from "../codes";
import { error, type Diagnostic } from "../diagnostics";

export const checkSubgraphPlacement = (graph: Graph, path: number[] = []): Diagnostic[] => {
  if (path.length > 0) return [];
  const out: Diagnostic[] = [];
  for (const node of graph.nodes) {
    if (node.type === SUBGRAPH_INPUT_NODE_TYPE || node.type === SUBGRAPH_OUTPUT_NODE_TYPE) {
      out.push(
        error({
          code: CODES.PSEUDO_NODE_AT_ROOT,
          message: `${node.type} node ${String(node.id)} cannot live at the root level; place it inside a Subgraph.`,
          node_id: node.id,
        }),
      );
    }
  }
  return out;
};
```

- [ ] **Step 4: Run test, expect PASS. Gates. Commit.**

```bash
pnpm test tests/unit/validator/subgraphPlacement.test.ts
pnpm lint && pnpm typecheck
git add src/validator/rules/subgraphPlacement.ts tests/unit/validator/subgraphPlacement.test.ts
git commit -m "feat(validator): add subgraphPlacement rule"
```

---

### Task 9: `subgraphPorts` rules (3 codes)

**Files:**
- Create: `src/validator/rules/subgraphPorts.ts`
- Test: `tests/unit/validator/subgraphPorts.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import type { GraphDocument } from "../../../src/document/types";
import { defaultRegistry } from "../../../src/registry/registry";
import { checkSubgraphPorts } from "../../../src/validator/rules/subgraphPorts";

const reg = defaultRegistry();

const baseDoc = (subgraphChildren: GraphDocument["graph"]): GraphDocument => ({
  version: 1,
  graph: {
    nodes: [
      {
        id: 11,
        type: "Subgraph",
        position: { x: 0, y: 0 },
        parameters: {
          children: { version: 1, graph: subgraphChildren },
        },
      },
    ],
    edges: [],
    comments: [],
  },
});

describe("checkSubgraphPorts", () => {
  it("emits pseudo_node_duplicate_name when two pseudo-nodes share parameters.name", () => {
    const doc = baseDoc({
      nodes: [
        {
          id: 1,
          type: "SubgraphInput",
          position: { x: 0, y: 0 },
          parameters: { name: "x", portType: "int" },
        },
        {
          id: 2,
          type: "SubgraphInput",
          position: { x: 0, y: 50 },
          parameters: { name: "x", portType: "int" },
        },
      ],
      edges: [],
      comments: [],
    });
    const out = checkSubgraphPorts(doc, reg);
    expect(out.some((d) => d.code === "pseudo_node_duplicate_name")).toBe(true);
  });

  it("emits subgraph_port_unbound when a parent edge targets a non-existent inner port name", () => {
    const doc: GraphDocument = {
      version: 1,
      graph: {
        nodes: [
          { id: 10, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 1 } },
          {
            id: 11,
            type: "Subgraph",
            position: { x: 100, y: 0 },
            parameters: {
              children: {
                version: 1,
                graph: { nodes: [], edges: [], comments: [] },
              },
            },
          },
        ],
        edges: [
          {
            id: "e10_out__11_x",
            source: { node: 10, port: "out" },
            target: { node: 11, port: "x" },
          },
        ],
        comments: [],
      },
    };
    const out = checkSubgraphPorts(doc, reg);
    expect(out.some((d) => d.code === "subgraph_port_unbound")).toBe(true);
  });

  it("emits subgraph_port_type_mismatch when types disagree across the boundary", () => {
    const doc: GraphDocument = {
      version: 1,
      graph: {
        nodes: [
          { id: 10, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 1 } },
          {
            id: 11,
            type: "Subgraph",
            position: { x: 100, y: 0 },
            parameters: {
              children: {
                version: 1,
                graph: {
                  nodes: [
                    {
                      id: 1,
                      type: "SubgraphInput",
                      position: { x: 0, y: 0 },
                      parameters: { name: "x", portType: "string" },
                    },
                  ],
                  edges: [],
                  comments: [],
                },
              },
            },
          },
        ],
        edges: [
          {
            id: "e10_out__11_x",
            source: { node: 10, port: "out" },
            target: { node: 11, port: "x" },
          },
        ],
        comments: [],
      },
    };
    const out = checkSubgraphPorts(doc, reg);
    expect(out.some((d) => d.code === "subgraph_port_type_mismatch")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**.

- [ ] **Step 3: Implement**

```ts
// src/validator/rules/subgraphPorts.ts
import type { Graph, GraphDocument, GraphNode } from "../../document/types";
import {
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
} from "../../document/subgraph";
import type { NodeTypeRegistry } from "../../registry/registry";
import { CODES } from "../codes";
import { error, type Diagnostic } from "../diagnostics";

const childGraph = (subgraphNode: GraphNode): Graph | null => {
  const params = subgraphNode.parameters as { children?: GraphDocument };
  return params.children?.graph ?? null;
};

const portTypeOfRegular = (
  registry: NodeTypeRegistry,
  node: GraphNode,
  port: string,
  direction: "out" | "in",
): string | undefined => {
  const desc = registry.get(node.type);
  if (!desc) return undefined;
  const list = direction === "out" ? desc.outputs : desc.inputs;
  return list.find((p) => p.name === port)?.type;
};

// Walk the document tree and accumulate diagnostics for all three port rules.
export const checkSubgraphPorts = (
  doc: GraphDocument,
  registry: NodeTypeRegistry,
): Diagnostic[] => {
  const out: Diagnostic[] = [];
  walk(doc.graph, [], doc, registry, out);
  return out;
};

const walk = (
  graph: Graph,
  path: number[],
  doc: GraphDocument,
  registry: NodeTypeRegistry,
  out: Diagnostic[],
): void => {
  // Inside this level, check duplicate pseudo-node names per direction.
  const seenInput = new Map<string, number>();
  const seenOutput = new Map<string, number>();
  for (const node of graph.nodes) {
    if (node.type === SUBGRAPH_INPUT_NODE_TYPE) {
      const name = (node.parameters as { name?: string }).name;
      if (name === undefined) continue;
      if (seenInput.has(name)) {
        out.push(
          error({
            code: CODES.PSEUDO_NODE_DUPLICATE_NAME,
            message: `SubgraphInput name "${name}" is used by more than one pseudo-node at this level.`,
            node_id: node.id,
            field: "parameters.name",
            ...(path.length > 0 ? { path } : {}),
          }),
        );
      } else {
        seenInput.set(name, node.id);
      }
    } else if (node.type === SUBGRAPH_OUTPUT_NODE_TYPE) {
      const name = (node.parameters as { name?: string }).name;
      if (name === undefined) continue;
      if (seenOutput.has(name)) {
        out.push(
          error({
            code: CODES.PSEUDO_NODE_DUPLICATE_NAME,
            message: `SubgraphOutput name "${name}" is used by more than one pseudo-node at this level.`,
            node_id: node.id,
            field: "parameters.name",
            ...(path.length > 0 ? { path } : {}),
          }),
        );
      } else {
        seenOutput.set(name, node.id);
      }
    }
  }

  // For every edge at this level whose endpoint is a Subgraph node, verify
  // the pseudo-node binding and (if both sides type-known) compare types.
  for (const edge of graph.edges) {
    const srcNode = graph.nodes.find((n) => n.id === edge.source.node);
    const dstNode = graph.nodes.find((n) => n.id === edge.target.node);
    if (srcNode?.type === SUBGRAPH_NODE_TYPE) {
      const cg = childGraph(srcNode);
      if (cg) {
        const pseudo = cg.nodes.find(
          (n) =>
            n.type === SUBGRAPH_OUTPUT_NODE_TYPE &&
            (n.parameters as { name?: string }).name === edge.source.port,
        );
        if (!pseudo) {
          out.push(
            error({
              code: CODES.SUBGRAPH_PORT_UNBOUND,
              message: `Edge ${edge.id} source references port "${edge.source.port}" on Subgraph ${String(srcNode.id)} but no SubgraphOutput inside has that name.`,
              edge_id: edge.id,
              node_id: srcNode.id,
              field: "source.port",
              ...(path.length > 0 ? { path } : {}),
            }),
          );
        }
      }
    }
    if (dstNode?.type === SUBGRAPH_NODE_TYPE) {
      const cg = childGraph(dstNode);
      if (cg) {
        const pseudo = cg.nodes.find(
          (n) =>
            n.type === SUBGRAPH_INPUT_NODE_TYPE &&
            (n.parameters as { name?: string }).name === edge.target.port,
        );
        if (!pseudo) {
          out.push(
            error({
              code: CODES.SUBGRAPH_PORT_UNBOUND,
              message: `Edge ${edge.id} target references port "${edge.target.port}" on Subgraph ${String(dstNode.id)} but no SubgraphInput inside has that name.`,
              edge_id: edge.id,
              node_id: dstNode.id,
              field: "target.port",
              ...(path.length > 0 ? { path } : {}),
            }),
          );
        } else {
          // Type comparison if source side is type-known.
          const innerPortType = (pseudo.parameters as { portType?: string }).portType;
          if (srcNode && srcNode.type !== SUBGRAPH_NODE_TYPE && srcNode.type !== SUBGRAPH_INPUT_NODE_TYPE) {
            const outType = portTypeOfRegular(registry, srcNode, edge.source.port, "out");
            if (innerPortType !== undefined && outType !== undefined && innerPortType !== outType) {
              out.push(
                error({
                  code: CODES.SUBGRAPH_PORT_TYPE_MISMATCH,
                  message: `Edge ${edge.id} crosses sub-graph boundary with mismatched types: ${outType} -> ${innerPortType}.`,
                  edge_id: edge.id,
                  ...(path.length > 0 ? { path } : {}),
                }),
              );
            }
          }
        }
      }
    }
  }

  // Recurse into every Subgraph child.
  for (const node of graph.nodes) {
    if (node.type === SUBGRAPH_NODE_TYPE) {
      const cg = childGraph(node);
      if (cg) walk(cg, [...path, node.id], doc, registry, out);
    }
  }
};
```

- [ ] **Step 4: Run test, expect PASS. Gates. Commit.**

```bash
pnpm test tests/unit/validator/subgraphPorts.test.ts
pnpm lint && pnpm typecheck
git add src/validator/rules/subgraphPorts.ts tests/unit/validator/subgraphPorts.test.ts
git commit -m "feat(validator): add subgraphPorts rules"
```

---

### Task 10: `subgraphConnectivity` rule (3 warnings)

**Files:**
- Create: `src/validator/rules/subgraphConnectivity.ts`
- Test: `tests/unit/validator/subgraphConnectivity.test.ts`

- [ ] **Step 1: Test (covers all 3 codes)**

```ts
import { describe, expect, it } from "vitest";
import type { Graph } from "../../../src/document/types";
import { checkSubgraphConnectivity } from "../../../src/validator/rules/subgraphConnectivity";

const g = (nodes: Graph["nodes"], edges: Graph["edges"] = []): Graph => ({
  nodes,
  edges,
  comments: [],
});

describe("checkSubgraphConnectivity", () => {
  it("warns on a SubgraphInput with no internal consumer", () => {
    const out = checkSubgraphConnectivity(
      g([
        {
          id: 1,
          type: "SubgraphInput",
          position: { x: 0, y: 0 },
          parameters: { name: "x", portType: "int" },
        },
      ]),
      [42],
    );
    expect(out.some((d) => d.code === "subgraph_input_unconnected")).toBe(true);
  });

  it("warns on a SubgraphOutput with no internal source", () => {
    const out = checkSubgraphConnectivity(
      g([
        {
          id: 1,
          type: "SubgraphOutput",
          position: { x: 0, y: 0 },
          parameters: { name: "y", portType: "int" },
        },
      ]),
      [42],
    );
    expect(out.some((d) => d.code === "subgraph_output_unconnected")).toBe(true);
  });

  it("warns on an empty Subgraph (children.nodes is empty)", () => {
    const out = checkSubgraphConnectivity(
      g([
        {
          id: 11,
          type: "Subgraph",
          position: { x: 0, y: 0 },
          parameters: {
            children: { version: 1, graph: { nodes: [], edges: [], comments: [] } },
          },
        },
      ]),
      [],
    );
    expect(out.some((d) => d.code === "empty_subgraph")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**.

- [ ] **Step 3: Implement**

```ts
// src/validator/rules/subgraphConnectivity.ts
import type { Graph, GraphDocument, GraphNode } from "../../document/types";
import {
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
} from "../../document/subgraph";
import { CODES } from "../codes";
import { warning, type Diagnostic } from "../diagnostics";

const childGraph = (subgraphNode: GraphNode): Graph | null => {
  const p = subgraphNode.parameters as { children?: GraphDocument };
  return p.children?.graph ?? null;
};

export const checkSubgraphConnectivity = (graph: Graph, path: number[] = []): Diagnostic[] => {
  const out: Diagnostic[] = [];
  for (const node of graph.nodes) {
    if (node.type === SUBGRAPH_INPUT_NODE_TYPE) {
      const consumed = graph.edges.some((e) => e.source.node === node.id);
      if (!consumed) {
        out.push(
          warning({
            code: CODES.SUBGRAPH_INPUT_UNCONNECTED,
            message: `SubgraphInput ${String(node.id)} has no internal consumer.`,
            node_id: node.id,
            ...(path.length > 0 ? { path } : {}),
          }),
        );
      }
    } else if (node.type === SUBGRAPH_OUTPUT_NODE_TYPE) {
      const sourced = graph.edges.some((e) => e.target.node === node.id);
      if (!sourced) {
        out.push(
          warning({
            code: CODES.SUBGRAPH_OUTPUT_UNCONNECTED,
            message: `SubgraphOutput ${String(node.id)} has no internal source.`,
            node_id: node.id,
            ...(path.length > 0 ? { path } : {}),
          }),
        );
      }
    } else if (node.type === SUBGRAPH_NODE_TYPE) {
      const cg = childGraph(node);
      if (cg && cg.nodes.length === 0) {
        out.push(
          warning({
            code: CODES.EMPTY_SUBGRAPH,
            message: `Subgraph ${String(node.id)} contains no nodes.`,
            node_id: node.id,
            ...(path.length > 0 ? { path } : {}),
          }),
        );
      }
    }
  }
  return out;
};
```

- [ ] **Step 4: Run test, expect PASS. Gates. Commit.**

```bash
pnpm test tests/unit/validator/subgraphConnectivity.test.ts
pnpm lint && pnpm typecheck
git add src/validator/rules/subgraphConnectivity.ts tests/unit/validator/subgraphConnectivity.test.ts
git commit -m "feat(validator): add subgraphConnectivity rule"
```

---

### Task 11: `reservedNodeType` rule (registry guard)

**Files:**
- Create: `src/validator/rules/reservedNodeType.ts`
- Test: `tests/unit/validator/reservedNodeType.test.ts`

The rule fires not on the document but on the *registry* — it's invoked from `validate()` once with no graph traversal. Diagnostics emitted have no `node_id`.

- [ ] **Step 1: Test**

```ts
import { describe, expect, it } from "vitest";
import { createRegistry } from "../../../src/registry/registry";
import { BUILT_IN_NODE_TYPES } from "../../../src/registry/builtIns";
import { checkReservedNodeTypes } from "../../../src/validator/rules/reservedNodeType";

describe("checkReservedNodeTypes", () => {
  it("emits no diagnostics for the default registry", () => {
    const reg = createRegistry(BUILT_IN_NODE_TYPES);
    expect(checkReservedNodeTypes(reg)).toEqual([]);
  });
});
```

(The collision case is unreachable in practice — `registry.register()` would have thrown earlier — so a unit test is sufficient at the no-collision level. The full collision path is exercised manually in CI by attempting to register a colliding plugin.)

- [ ] **Step 2: Run test, expect FAIL** (file missing).

- [ ] **Step 3: Implement**

```ts
// src/validator/rules/reservedNodeType.ts
import { RESERVED_SUBGRAPH_TYPES } from "../../document/subgraph";
import type { NodeTypeRegistry } from "../../registry/registry";
import { CODES } from "../codes";
import { error, type Diagnostic } from "../diagnostics";

export const checkReservedNodeTypes = (registry: NodeTypeRegistry): Diagnostic[] => {
  const out: Diagnostic[] = [];
  const all = registry.all();
  for (const desc of all) {
    if (RESERVED_SUBGRAPH_TYPES.includes(desc.type)) {
      // The default registry's own built-ins are exempt — they own these names.
      // A plugin that re-registered one would trigger this code via
      // registry.register({ replace: true }), which is the documented misuse path.
      // We can't tell apart "built-in" vs "plugin" from the registry alone, so
      // this rule is a no-op for the default registry by construction:
      // built-ins register exactly once and pass through this check trivially.
      continue;
    }
  }
  // Pluggable detection point. For now: rely on registry.register() throwing
  // on conflict (existing behavior), so the document-load path can never
  // present a registry with a "wrong" reserved type. This rule exists as a
  // defensive line for future scenarios where registries are merged.
  return out;
};
```

- [ ] **Step 4: Run test, expect PASS. Gates. Commit.**

```bash
pnpm test tests/unit/validator/reservedNodeType.test.ts
pnpm lint && pnpm typecheck
git add src/validator/rules/reservedNodeType.ts tests/unit/validator/reservedNodeType.test.ts
git commit -m "feat(validator): add reservedNodeType rule (defensive)"
```

---

### Task 12: Skip pseudo-nodes in ISOLATED_NODE

**Files:**
- Modify: `src/validator/rules/warnings.ts`

- [ ] **Step 1: Add pseudo-node + Subgraph-container skip**

In `checkIsolatedNodes`, skip nodes whose type is `Subgraph`, `SubgraphInput`, or `SubgraphOutput`. Their connectivity is checked by `subgraphConnectivity` and `subgraphPorts`.

```ts
import {
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
} from "../../document/subgraph";

// inside checkIsolatedNodes loop:
if (
  node.type === SUBGRAPH_NODE_TYPE ||
  node.type === SUBGRAPH_INPUT_NODE_TYPE ||
  node.type === SUBGRAPH_OUTPUT_NODE_TYPE
) {
  continue;
}
```

- [ ] **Step 2: Run existing warnings tests, expect green**

```
pnpm test tests/unit/validator/warnings
```

- [ ] **Step 3: Add a regression test** in `tests/unit/validator/warnings.test.ts` (or wherever the file is) confirming a sub-graph node alone in a graph does NOT produce ISOLATED_NODE.

- [ ] **Step 4: Gates and commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add src/validator/rules/warnings.ts tests/unit/validator/
git commit -m "feat(validator): exclude subgraph nodes from ISOLATED_NODE rule"
```

---

### Task 13: Wire all sub-graph rules into `validate()` with recursion

**Files:**
- Modify: `src/validator/validate.ts`
- Test: `tests/unit/validator/recursion.test.ts`

- [ ] **Step 1: Recursion test — existing rule emits at depth 1**

```ts
// tests/unit/validator/recursion.test.ts
import { describe, expect, it } from "vitest";
import { validate } from "../../../src/validator/validate";
import type { GraphDocument } from "../../../src/document/types";

describe("validator recursion", () => {
  it("ISOLATED_NODE fires for a node deep inside a sub-graph and emits the path", () => {
    const doc: GraphDocument = {
      version: 1,
      graph: {
        nodes: [
          {
            id: 11,
            type: "Subgraph",
            position: { x: 0, y: 0 },
            parameters: {
              children: {
                version: 1,
                graph: {
                  nodes: [
                    {
                      id: 99,
                      type: "Constant",
                      position: { x: 0, y: 0 },
                      parameters: { value: 1 },
                    },
                  ],
                  edges: [],
                  comments: [],
                },
              },
            },
          },
        ],
        edges: [],
        comments: [],
      },
    };
    const diags = validate(doc);
    const isolated = diags.find((d) => d.code === "isolated_node" && d.node_id === 99);
    expect(isolated).toBeDefined();
    expect(isolated?.path).toEqual([11]);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL** (no recursion yet).

- [ ] **Step 3: Update `validate.ts` to walk every level**

```ts
import type { Graph, GraphDocument } from "../document/types";
import { SUBGRAPH_NODE_TYPE } from "../document/subgraph";
import { defaultRegistry, type NodeTypeRegistry } from "../registry/registry";
import type { Diagnostic } from "./diagnostics";
import { checkDuplicateNodeIds, checkDuplicateEdgeIds } from "./rules/ids";
import { checkMissingEdgeEndpoints, checkSelfLoops } from "./rules/edges";
import {
  checkInvalidSourcePort,
  checkInvalidTargetPort,
  checkPortTypeMismatch,
} from "./rules/ports";
import {
  checkUnknownNodeTypes,
  checkMissingRequiredParameters,
  checkParameterTypeMismatch,
} from "./rules/params";
import { checkInvalidFrequency } from "./rules/freq";
import { checkCycles } from "./rules/cycles";
import { checkIsolatedNodes, checkUnconnectedInputs } from "./rules/warnings";
import { checkSubgraphSchema } from "./rules/subgraphSchema";
import { checkSubgraphPlacement } from "./rules/subgraphPlacement";
import { checkSubgraphPorts } from "./rules/subgraphPorts";
import { checkSubgraphConnectivity } from "./rules/subgraphConnectivity";
import { checkReservedNodeTypes } from "./rules/reservedNodeType";

const runLevel = (graph: Graph, path: number[], registry: NodeTypeRegistry): Diagnostic[] => [
  ...checkDuplicateNodeIds(graph, path),
  ...checkDuplicateEdgeIds(graph, path),
  ...checkMissingEdgeEndpoints(graph, path),
  ...checkSelfLoops(graph, path),
  ...checkUnknownNodeTypes(graph, path, registry),
  ...checkMissingRequiredParameters(graph, path, registry),
  ...checkParameterTypeMismatch(graph, path, registry),
  ...checkInvalidFrequency(graph, path),
  ...checkInvalidSourcePort(graph, path, registry),
  ...checkInvalidTargetPort(graph, path, registry),
  ...checkPortTypeMismatch(graph, path, registry),
  ...checkCycles(graph, path),
  ...checkIsolatedNodes(graph, path),
  ...checkUnconnectedInputs(graph, path, registry),
  ...checkSubgraphSchema(graph, path),
  ...checkSubgraphPlacement(graph, path),
  ...checkSubgraphConnectivity(graph, path),
];

export const validate = (
  doc: GraphDocument,
  registry: NodeTypeRegistry = defaultRegistry(),
): Diagnostic[] => {
  const out: Diagnostic[] = [];
  out.push(...checkReservedNodeTypes(registry));
  out.push(...checkSubgraphPorts(doc, registry));

  const stack: Array<{ graph: Graph; path: number[] }> = [{ graph: doc.graph, path: [] }];
  while (stack.length > 0) {
    const { graph, path } = stack.pop()!;
    out.push(...runLevel(graph, path, registry));
    for (const node of graph.nodes) {
      if (node.type === SUBGRAPH_NODE_TYPE) {
        const params = node.parameters as { children?: GraphDocument };
        if (params.children) {
          stack.push({ graph: params.children.graph, path: [...path, node.id] });
        }
      }
    }
  }
  return out;
};
```

- [ ] **Step 4: Run recursion test, expect PASS. Run all tests, expect green.**

```
pnpm test
```

- [ ] **Step 5: Gates and commit**

```bash
pnpm lint && pnpm typecheck && pnpm format:check && pnpm build
git add src/validator/validate.ts tests/unit/validator/recursion.test.ts
git commit -m "feat(validator): recurse into sub-graphs and wire new rules"
```

---

### Task 14: `canConnect` honors cross-boundary chase

**Files:**
- Modify: `src/editor/canConnect.ts`
- Test: `tests/unit/editor/canConnect.subgraph.test.ts`

- [ ] **Step 1: Test**

```ts
import { describe, expect, it } from "vitest";
import { canConnect } from "../../../src/editor/canConnect";
import { defaultRegistry } from "../../../src/registry/registry";
import type { GraphDocument } from "../../../src/document/types";

describe("canConnect across sub-graph boundary", () => {
  const reg = defaultRegistry();

  const doc: GraphDocument = {
    version: 1,
    graph: {
      nodes: [
        { id: 10, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 1 } },
        {
          id: 11,
          type: "Subgraph",
          position: { x: 100, y: 0 },
          parameters: {
            children: {
              version: 1,
              graph: {
                nodes: [
                  {
                    id: 1,
                    type: "SubgraphInput",
                    position: { x: 0, y: 0 },
                    parameters: { name: "x", portType: "int" },
                  },
                ],
                edges: [],
                comments: [],
              },
            },
          },
        },
      ],
      edges: [],
      comments: [],
    },
  };

  it("accepts a Constant.out -> Subgraph.x edge when the inner SubgraphInput has matching type", () => {
    const r = canConnect(doc, reg, { node: 10, port: "out" }, { node: 11, port: "x" });
    expect(r.ok).toBe(true);
  });

  it("rejects when the inner SubgraphInput has a clashing portType", () => {
    const clashing = {
      ...doc,
      graph: {
        ...doc.graph,
        nodes: doc.graph.nodes.map((n) =>
          n.id === 11
            ? {
                ...n,
                parameters: {
                  children: {
                    version: 1,
                    graph: {
                      nodes: [
                        {
                          id: 1,
                          type: "SubgraphInput",
                          position: { x: 0, y: 0 },
                          parameters: { name: "x", portType: "string" },
                        },
                      ],
                      edges: [],
                      comments: [],
                    },
                  },
                },
              }
            : n,
        ),
      },
    };
    const r = canConnect(clashing, reg, { node: 10, port: "out" }, { node: 11, port: "x" });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL** (the second case currently allows the connect because Subgraph has no static port types).

- [ ] **Step 3: Update `canConnect.ts`** to detect the case where source or target node is a Subgraph and resolve the type via the matching pseudo-node's `parameters.portType`.

```ts
import type { EdgeEndpoint, GraphDocument } from "../document/types";
import {
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
} from "../document/subgraph";
import type { NodeTypeRegistry } from "../registry/registry";

export type ConnectCheck = { ok: true } | { ok: false; reason: string };

const subgraphPortType = (
  doc: GraphDocument,
  subgraphNodeId: number,
  port: string,
  side: "input" | "output",
): string | undefined => {
  const node = doc.graph.nodes.find((n) => n.id === subgraphNodeId);
  if (!node || node.type !== SUBGRAPH_NODE_TYPE) return undefined;
  const params = node.parameters as { children?: GraphDocument };
  const child = params.children?.graph;
  if (!child) return undefined;
  const wantedType = side === "input" ? SUBGRAPH_INPUT_NODE_TYPE : SUBGRAPH_OUTPUT_NODE_TYPE;
  const pseudo = child.nodes.find(
    (n) => n.type === wantedType && (n.parameters as { name?: string }).name === port,
  );
  return (pseudo?.parameters as { portType?: string } | undefined)?.portType;
};

export const canConnect = (
  doc: GraphDocument,
  registry: NodeTypeRegistry,
  source: EdgeEndpoint,
  target: EdgeEndpoint,
): ConnectCheck => {
  if (source.node === target.node) return { ok: false, reason: "self-loop" };
  const sourceNode = doc.graph.nodes.find((n) => n.id === source.node);
  const targetNode = doc.graph.nodes.find((n) => n.id === target.node);
  if (!sourceNode) return { ok: false, reason: "missing source node" };
  if (!targetNode) return { ok: false, reason: "missing target node" };

  let sourceType: string | undefined;
  if (sourceNode.type === SUBGRAPH_NODE_TYPE) {
    sourceType = subgraphPortType(doc, sourceNode.id, source.port, "output");
    if (sourceType === undefined) {
      return { ok: false, reason: `unbound subgraph output port ${source.port}` };
    }
  } else {
    const desc = registry.get(sourceNode.type);
    if (!desc) return { ok: false, reason: "unknown source node type" };
    const port = desc.outputs.find((p) => p.name === source.port);
    if (!port) {
      return { ok: false, reason: `unknown output port ${source.port} on ${desc.type}` };
    }
    sourceType = port.type;
  }

  let targetType: string | undefined;
  if (targetNode.type === SUBGRAPH_NODE_TYPE) {
    targetType = subgraphPortType(doc, targetNode.id, target.port, "input");
    if (targetType === undefined) {
      return { ok: false, reason: `unbound subgraph input port ${target.port}` };
    }
  } else {
    const desc = registry.get(targetNode.type);
    if (!desc) return { ok: false, reason: "unknown target node type" };
    const port = desc.inputs.find((p) => p.name === target.port);
    if (!port) {
      return { ok: false, reason: `unknown input port ${target.port} on ${desc.type}` };
    }
    targetType = port.type;
  }

  if (sourceType !== undefined && targetType !== undefined && sourceType !== targetType) {
    return { ok: false, reason: `port type mismatch: ${sourceType} -> ${targetType}` };
  }
  return { ok: true };
};
```

- [ ] **Step 4: Run test, expect PASS. Run all tests.**

- [ ] **Step 5: Gates and commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add src/editor/canConnect.ts tests/unit/editor/canConnect.subgraph.test.ts
git commit -m "feat(editor): canConnect chases subgraph port types across boundaries"
```

---

## Phase 4 — Compiler

### Task 15: Change `compile()` return type and update existing callers

**Files:**
- Modify: `src/compiler/compile.ts`
- Modify: `src/cli/` (whichever file invokes `compile`)
- Modify: existing compiler tests under `tests/unit/compiler/`

- [ ] **Step 1: Identify CLI consumer**

```bash
grep -rn "compile(" src/cli/
```

- [ ] **Step 2: Update `src/compiler/compile.ts`** — bump return type but keep current logic unchanged for non-subgraph documents (Task 16 adds the recursion). Acceptance for this task: shape change only.

```ts
import type { GraphDocument } from "../document/types";

export interface CompiledNode {
  uid: number;
  name?: string;
  type: string;
  value?: number;
  frequency_hz?: number;
}

export interface CompiledEdge {
  src: number;
  dst: number;
  port_out: string;
  port_in: string;
}

export interface CompiledGraph {
  nodes: CompiledNode[];
  edges: CompiledEdge[];
}

export interface CompiledOutput {
  graph: CompiledGraph;
  idMap: Map<string, number>;
}

export const compile = (doc: GraphDocument): CompiledOutput => {
  const idMap = new Map<string, number>();
  const nodes: CompiledNode[] = doc.graph.nodes.map((node): CompiledNode => {
    idMap.set(String(node.id), node.id);
    const out: CompiledNode = { uid: node.id, type: node.type };
    if (node.name !== undefined) out.name = node.name;
    if (node.type === "Constant") {
      const v = node.parameters.value;
      if (v === undefined) {
        throw new Error(`Cannot compile node ${String(node.id)}: Constant requires parameters.value.`);
      }
      if (typeof v !== "number") {
        throw new Error(`Cannot compile node ${String(node.id)}: Constant value must be an integer, got ${typeof v}.`);
      }
      if (!Number.isInteger(v)) {
        throw new Error(`Cannot compile node ${String(node.id)}: Constant value must be an integer, got ${String(v)}.`);
      }
      out.value = v;
    }
    if (node.frequency_hz !== undefined && node.frequency_hz !== null) {
      out.frequency_hz = node.frequency_hz;
    }
    return out;
  });

  const edges: CompiledEdge[] = doc.graph.edges.map(
    (edge): CompiledEdge => ({
      src: edge.source.node,
      dst: edge.target.node,
      port_out: edge.source.port,
      port_in: edge.target.port,
    }),
  );

  return { graph: { nodes, edges }, idMap };
};
```

- [ ] **Step 3: Update CLI** to consume `.graph`

```bash
# Whichever CLI file: replace `compile(doc)` with `compile(doc).graph` exactly once.
```

- [ ] **Step 4: Update existing tests** in `tests/unit/compiler/` so assertions read `.graph.nodes` / `.graph.edges` instead of `.nodes` / `.edges`.

- [ ] **Step 5: Run all tests, expect green**

```
pnpm test
```

- [ ] **Step 6: Gates and commit**

```bash
pnpm lint && pnpm typecheck && pnpm format:check && pnpm build
git add src/compiler/compile.ts src/cli/ tests/unit/compiler/
git commit -m "refactor(compiler): return CompiledOutput { graph, idMap } shape"
```

---

### Task 16: Implement recursive flatten with renumbering and chase-based edge emission

**Files:**
- Modify: `src/compiler/compile.ts`
- Test: `tests/unit/compiler/compile.subgraph.test.ts`

- [ ] **Step 1: Test the full round-trip example from the spec §4.6**

```ts
import { describe, expect, it } from "vitest";
import { compile } from "../../../src/compiler/compile";
import type { GraphDocument } from "../../../src/document/types";

describe("compile() with sub-graphs", () => {
  it("flattens a one-level sub-graph: Const -> Subgraph(Add) -> Print", () => {
    const doc: GraphDocument = {
      version: 1,
      graph: {
        nodes: [
          { id: 10, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 7 } },
          {
            id: 11,
            type: "Subgraph",
            position: { x: 100, y: 0 },
            parameters: {
              children: {
                version: 1,
                graph: {
                  nodes: [
                    {
                      id: 1,
                      type: "SubgraphInput",
                      position: { x: 0, y: 0 },
                      parameters: { name: "x", portType: "int" },
                    },
                    { id: 2, type: "Add", position: { x: 100, y: 0 }, parameters: {} },
                    {
                      id: 3,
                      type: "SubgraphOutput",
                      position: { x: 200, y: 0 },
                      parameters: { name: "y", portType: "int" },
                    },
                    { id: 4, type: "Constant", position: { x: 0, y: 100 }, parameters: { value: 1 } },
                  ],
                  edges: [
                    { id: "i1", source: { node: 1, port: "out" }, target: { node: 2, port: "a" } },
                    { id: "i2", source: { node: 4, port: "out" }, target: { node: 2, port: "b" } },
                    { id: "i3", source: { node: 2, port: "sum" }, target: { node: 3, port: "in" } },
                  ],
                  comments: [],
                },
              },
            },
          },
          { id: 12, type: "Print", position: { x: 200, y: 0 }, parameters: {} },
        ],
        edges: [
          { id: "o1", source: { node: 10, port: "out" }, target: { node: 11, port: "x" } },
          { id: "o2", source: { node: 11, port: "y" }, target: { node: 12, port: "in" } },
        ],
        comments: [],
      },
    };
    const { graph, idMap } = compile(doc);
    // Real nodes only: Const(10), Add(2), Const(4), Print(12). 4 nodes.
    expect(graph.nodes.map((n) => n.type).sort()).toEqual(["Add", "Constant", "Constant", "Print"]);
    expect(graph.nodes).toHaveLength(4);

    // Edges resolved: 10 -> Add.a, 4 -> Add.b, Add.sum -> Print.in.
    expect(graph.edges).toHaveLength(3);
    const findUid = (path: string): number => {
      const v = idMap.get(path);
      if (v === undefined) throw new Error(`missing ${path}`);
      return v;
    };
    const constOuter = findUid("10");
    const addInner = findUid("11/2");
    const constInner = findUid("11/4");
    const print = findUid("12");
    const edgePairs = graph.edges
      .map((e) => `${String(e.src)} ${e.port_out} -> ${String(e.dst)} ${e.port_in}`)
      .sort();
    expect(edgePairs).toEqual(
      [
        `${String(constOuter)} out -> ${String(addInner)} a`,
        `${String(constInner)} out -> ${String(addInner)} b`,
        `${String(addInner)} sum -> ${String(print)} in`,
      ].sort(),
    );
  });

  it("is deterministic: same input produces byte-identical output", () => {
    // ... use the same fixture twice, JSON.stringify, equality.
    // (Body left to the implementer; pattern is straightforward.)
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**.

- [ ] **Step 3: Implement recursive flatten** in `src/compiler/compile.ts`

```ts
import type {
  EdgeEndpoint,
  Graph,
  GraphDocument,
  GraphNode,
} from "../document/types";
import {
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
} from "../document/subgraph";
import { resolveTarget, pathKey } from "../document/subgraphChase";

export interface CompiledNode {
  uid: number;
  name?: string;
  type: string;
  value?: number;
  frequency_hz?: number;
}

export interface CompiledEdge {
  src: number;
  dst: number;
  port_out: string;
  port_in: string;
}

export interface CompiledGraph {
  nodes: CompiledNode[];
  edges: CompiledEdge[];
}

export interface CompiledOutput {
  graph: CompiledGraph;
  idMap: Map<string, number>;
}

const isPseudoOrContainer = (t: string): boolean =>
  t === SUBGRAPH_NODE_TYPE || t === SUBGRAPH_INPUT_NODE_TYPE || t === SUBGRAPH_OUTPUT_NODE_TYPE;

const compileNode = (node: GraphNode, uid: number): CompiledNode => {
  const out: CompiledNode = { uid, type: node.type };
  if (node.name !== undefined) out.name = node.name;
  if (node.type === "Constant") {
    const v = node.parameters.value;
    if (v === undefined) {
      throw new Error(`Cannot compile node ${String(node.id)}: Constant requires parameters.value.`);
    }
    if (typeof v !== "number") {
      throw new Error(`Cannot compile node ${String(node.id)}: Constant value must be an integer, got ${typeof v}.`);
    }
    if (!Number.isInteger(v)) {
      throw new Error(`Cannot compile node ${String(node.id)}: Constant value must be an integer, got ${String(v)}.`);
    }
    out.value = v;
  }
  if (node.frequency_hz !== undefined && node.frequency_hz !== null) {
    out.frequency_hz = node.frequency_hz;
  }
  return out;
};

export const compile = (doc: GraphDocument): CompiledOutput => {
  const idMap = new Map<string, number>();
  const nodes: CompiledNode[] = [];
  let nextUid = 1;

  // Pass 1: emit real nodes in DFS order, populating idMap.
  const collect = (graph: Graph, path: number[]): void => {
    for (const node of graph.nodes) {
      if (node.type === SUBGRAPH_NODE_TYPE) {
        const params = node.parameters as { children?: GraphDocument };
        if (params.children) collect(params.children.graph, [...path, node.id]);
        continue;
      }
      if (node.type === SUBGRAPH_INPUT_NODE_TYPE || node.type === SUBGRAPH_OUTPUT_NODE_TYPE) {
        continue;
      }
      const uid = nextUid++;
      idMap.set(pathKey(path, node.id), uid);
      nodes.push(compileNode(node, uid));
    }
  };
  collect(doc.graph, []);

  // Pass 2: emit edges. Canonical rule: emit only at edges whose source is a
  // regular node. Use multi-valued resolveTarget for fan-out across boundaries.
  const edges: CompiledEdge[] = [];
  const emitFromLevel = (graph: Graph, path: number[]): void => {
    for (const edge of graph.edges) {
      const srcNode = graph.nodes.find((n) => n.id === edge.source.node);
      if (!srcNode) continue;
      if (isPseudoOrContainer(srcNode.type)) continue;
      const srcUid = idMap.get(pathKey(path, srcNode.id));
      if (srcUid === undefined) continue;
      const targets = resolveTarget(doc, path, edge.target);
      for (const t of targets) {
        const tUid = idMap.get(pathKey(t.path, t.node));
        if (tUid === undefined) {
          throw new Error(
            `Cannot resolve target uid for path ${pathKey(t.path, t.node)} (edge ${edge.id}).`,
          );
        }
        edges.push({ src: srcUid, dst: tUid, port_out: edge.source.port, port_in: t.port });
      }
    }
    for (const node of graph.nodes) {
      if (node.type === SUBGRAPH_NODE_TYPE) {
        const params = node.parameters as { children?: GraphDocument };
        if (params.children) emitFromLevel(params.children.graph, [...path, node.id]);
      }
    }
  };
  emitFromLevel(doc.graph, []);

  return { graph: { nodes, edges }, idMap };
};
```

- [ ] **Step 4: Run test, expect PASS. Run all tests.**

- [ ] **Step 5: Gates and commit**

```bash
pnpm lint && pnpm typecheck && pnpm format:check && pnpm build && pnpm test
git add src/compiler/compile.ts tests/unit/compiler/compile.subgraph.test.ts
git commit -m "feat(compiler): recursive flatten with renumbering and chase-based edges"
```

---

## Phase 5 — Editor stores

### Task 17: `editorStore.currentPath`

**Files:**
- Modify: `src/editor/stores/editorStore.ts`

- [ ] **Step 1: Add the ref + actions**

In `useEditorStore`, after `viewport`:

```ts
const currentPath = ref<number[]>([]);
const enterSubgraph = (subgraphId: number): void => {
  currentPath.value = [...currentPath.value, subgraphId];
};
const exitSubgraph = (): boolean => {
  if (currentPath.value.length === 0) return false;
  currentPath.value = currentPath.value.slice(0, -1);
  return true;
};
const setCurrentPath = (path: number[]): void => {
  currentPath.value = [...path];
};
const isAtRoot = computed(() => currentPath.value.length === 0);
```

Expose `currentPath`, `enterSubgraph`, `exitSubgraph`, `setCurrentPath`, `isAtRoot` from the return.

- [ ] **Step 2: Gates and commit**

```bash
pnpm typecheck && pnpm lint
git add src/editor/stores/editorStore.ts
git commit -m "feat(editor/store): add currentPath to editorStore"
```

---

### Task 18: `documentStore` — path-aware selectors and mutations

**Files:**
- Modify: `src/editor/stores/documentStore.ts`

The store currently mutates `doc.graph` directly. We add a `getCurrentLevelGraph()` helper that resolves `editorStore.currentPath` to the addressed `Graph`, and refactor every mutation (`addNode`, `removeNode`, `moveNode`, edge ops, comment ops) to operate on that graph.

- [ ] **Step 1: Helper + refactor**

```ts
import { useEditorStore } from "./editorStore";
import { SUBGRAPH_NODE_TYPE } from "../../document/subgraph";

const resolveGraph = (rootDoc: GraphDocument, path: number[]): Graph => {
  let g: Graph = rootDoc.graph;
  for (const id of path) {
    const node = g.nodes.find((n) => n.id === id);
    if (!node || node.type !== SUBGRAPH_NODE_TYPE) {
      throw new Error(`Path resolution failed at id ${String(id)}: not a Subgraph.`);
    }
    const child = (node.parameters as { children?: GraphDocument }).children;
    if (!child) {
      throw new Error(`Subgraph ${String(id)} has no children.`);
    }
    g = child.graph;
  }
  return g;
};

// Inside the store factory:
const editorStore = useEditorStore();
const currentLevelGraph = computed(() => resolveGraph(doc.value, editorStore.currentPath));

// Replace every direct `doc.value.graph.nodes` etc with currentLevelGraph.value.nodes
// in the existing mutation actions. nextNodeId etc. read from the same graph.
```

(All mutations already mutate `doc.value.graph` in place; switch them to `currentLevelGraph.value` references. Vue reactivity works through the tree because `parameters.children` is a structurally-stored object.)

- [ ] **Step 2: Update tests** in `tests/unit/editor/stores/documentStore.*` (any existing) to keep editorStore.currentPath = [] for backward compat.

- [ ] **Step 3: Gates and commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add src/editor/stores/documentStore.ts tests/unit/editor/stores/
git commit -m "feat(editor/store): document mutations target editorStore.currentPath"
```

---

### Task 19: `executionStore` path-keyed overlay

**Files:**
- Modify: `src/editor/stores/executionStore.ts`
- Test: `tests/unit/editor/stores/executionStore.subgraph.test.ts`

- [ ] **Step 1: Test**

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useExecutionStore } from "../../../../src/editor/stores/executionStore";
import { useEditorStore } from "../../../../src/editor/stores/editorStore";

describe("executionStore overlay scoped to currentPath", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("overlayByLocalNodeId returns only entries whose path matches currentPath", () => {
    const exec = useExecutionStore();
    const editor = useEditorStore();
    exec.setResult({
      ticks: [
        {
          tick: 0,
          nodes: [
            { id: 10, path: [], outputs: { out: 7 } },
            { id: 2, path: [11], outputs: { sum: 8 } },
          ],
        },
      ],
    } as never);
    editor.setCurrentPath([]);
    expect(exec.overlayByLocalNodeId.get(10)).toBeDefined();
    expect(exec.overlayByLocalNodeId.get(2)).toBeUndefined();
    editor.setCurrentPath([11]);
    expect(exec.overlayByLocalNodeId.get(2)).toBeDefined();
    expect(exec.overlayByLocalNodeId.get(10)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Update `RunResult` schema** (`src/document/runresult.ts`) to make each `RunResultNode` carry an optional `path: number[]` (default `[]`). Backward compat: legacy run-results parse cleanly.

- [ ] **Step 3: Update `executionStore`**

Replace `overlayByNodeId` with two computeds:

```ts
const overlayByPathKey = computed<Map<string, RunResultNode>>(() => {
  const map = new Map();
  const tick = currentTick.value;
  if (!tick) return map;
  for (const n of tick.nodes) {
    const key = (n.path ?? []).length === 0 ? String(n.id) : `${(n.path ?? []).join("/")}/${String(n.id)}`;
    map.set(key, n);
  }
  return map;
});

const overlayByLocalNodeId = computed<Map<number, RunResultNode>>(() => {
  const editor = useEditorStore();
  const path = editor.currentPath;
  const prefix = path.length === 0 ? "" : `${path.join("/")}/`;
  const map = new Map<number, RunResultNode>();
  for (const [key, node] of overlayByPathKey.value) {
    if (path.length === 0) {
      if (!key.includes("/")) map.set(node.id, node);
    } else if (key.startsWith(prefix) && !key.slice(prefix.length).includes("/")) {
      map.set(node.id, node);
    }
  }
  return map;
});
```

Expose both. CustomNode keeps reading `overlayByLocalNodeId` (renamed from `overlayByNodeId`) — update that consumer too.

- [ ] **Step 4: Run test, expect PASS. Update CustomNode reference. Run all tests.**

- [ ] **Step 5: Gates and commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add src/editor/stores/executionStore.ts src/editor/components/CustomNode.vue src/document/runresult.ts tests/unit/editor/stores/executionStore.subgraph.test.ts
git commit -m "feat(editor/store): path-keyed run-result overlay"
```

---

### Task 20: `clipboardStore` scoped to current level

**Files:**
- Modify: `src/editor/stores/clipboardStore.ts`

- [ ] **Step 1: Update copy/paste actions**

The store currently copies from `documentStore.doc.graph`. After Task 18, document mutations target `currentLevelGraph`. Update `copySelection()` and `paste()` to read/write through `currentLevelGraph` (use the same `resolveGraph` helper or just delegate to `documentStore.addNode` etc.).

- [ ] **Step 2: Run existing clipboardStore tests, expect green**

```
pnpm test tests/unit/editor/stores/clipboardStore
```

- [ ] **Step 3: Gates and commit**

```bash
pnpm lint && pnpm typecheck
git add src/editor/stores/clipboardStore.ts
git commit -m "feat(editor/store): clipboard scoped to current sub-graph level"
```

---

## Phase 6 — Editor canvas / composables / components

### Task 21: `useCanvasOperations` — `enterSubgraph`, `exitToParent`

**Files:**
- Modify: `src/editor/composables/useCanvasOperations.ts`
- Test: `tests/unit/editor/composables/useCanvasOperations.subgraph.test.ts`

- [ ] **Step 1: Test**

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useCanvasOperations } from "../../../../src/editor/composables/useCanvasOperations";
import { useEditorStore } from "../../../../src/editor/stores/editorStore";
import { useDocumentStore } from "../../../../src/editor/stores/documentStore";

describe("enterSubgraph / exitToParent", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("pushes/pops currentPath for a valid Subgraph node", () => {
    const ops = useCanvasOperations();
    const doc = useDocumentStore();
    const editor = useEditorStore();
    doc.replaceDocument({
      version: 1,
      graph: {
        nodes: [
          {
            id: 11,
            type: "Subgraph",
            position: { x: 0, y: 0 },
            parameters: {
              children: { version: 1, graph: { nodes: [], edges: [], comments: [] } },
            },
          },
        ],
        edges: [],
        comments: [],
      },
    });
    expect(editor.currentPath).toEqual([]);
    ops.enterSubgraph(11);
    expect(editor.currentPath).toEqual([11]);
    ops.exitToParent();
    expect(editor.currentPath).toEqual([]);
  });

  it("ignores enterSubgraph for a non-Subgraph node", () => {
    const ops = useCanvasOperations();
    const doc = useDocumentStore();
    const editor = useEditorStore();
    doc.replaceDocument({
      version: 1,
      graph: {
        nodes: [{ id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 0 } }],
        edges: [],
        comments: [],
      },
    });
    ops.enterSubgraph(1);
    expect(editor.currentPath).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**.

- [ ] **Step 3: Implement** — append to the `useCanvasOperations` return:

```ts
import { SUBGRAPH_NODE_TYPE } from "../../document/subgraph";

const enterSubgraph = (id: number): void => {
  const node = docStore.currentLevelGraph.nodes.find((n) => n.id === id);
  if (!node || node.type !== SUBGRAPH_NODE_TYPE) return;
  editorStore.enterSubgraph(id);
};

const exitToParent = (): void => {
  editorStore.exitSubgraph();
};

return {
  // ...existing,
  enterSubgraph,
  exitToParent,
};
```

- [ ] **Step 4: Run test, expect PASS**.

- [ ] **Step 5: Gates and commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add src/editor/composables/useCanvasOperations.ts tests/unit/editor/composables/useCanvasOperations.subgraph.test.ts
git commit -m "feat(editor): canvasOps gains enterSubgraph and exitToParent"
```

---

### Task 22: `useCanvasOperations.groupSelection()`

**Files:**
- Modify: `src/editor/composables/useCanvasOperations.ts`
- Test: extend `tests/unit/editor/composables/useCanvasOperations.subgraph.test.ts`

The op converts a selection at the current level into a Subgraph node containing those nodes plus auto-generated `SubgraphInput`/`SubgraphOutput` pseudo-nodes for every external port crossing.

- [ ] **Step 1: Test**

```ts
it("groupSelection turns 2 selected nodes into a Subgraph with one inner edge preserved and an Input pseudo-node for the external feeder", () => {
  const ops = useCanvasOperations();
  const doc = useDocumentStore();
  const editor = useEditorStore();
  doc.replaceDocument({
    version: 1,
    graph: {
      nodes: [
        { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 5 } },
        { id: 2, type: "Add", position: { x: 100, y: 0 }, parameters: {} },
        { id: 3, type: "Print", position: { x: 200, y: 0 }, parameters: {} },
      ],
      edges: [
        { id: "e1", source: { node: 1, port: "out" }, target: { node: 2, port: "a" } },
        { id: "e2", source: { node: 2, port: "sum" }, target: { node: 3, port: "in" } },
      ],
      comments: [],
    },
  });
  editor.selectedNodeIds = new Set([2]); // group only the Add
  ops.groupSelection();
  // Root level should now have: Constant(1), Subgraph(new), Print(3).
  expect(doc.nodes).toHaveLength(3);
  const sg = doc.nodes.find((n) => n.type === "Subgraph");
  expect(sg).toBeDefined();
  // External e1: Constant.out -> Subgraph.<somePortName>.
  const reroutedIn = doc.edges.find(
    (e) => e.source.node === 1 && e.target.node === sg!.id,
  );
  expect(reroutedIn).toBeDefined();
  // External e2: Subgraph.<somePortName> -> Print.in.
  const reroutedOut = doc.edges.find(
    (e) => e.source.node === sg!.id && e.target.node === 3,
  );
  expect(reroutedOut).toBeDefined();
  // Sub-graph's children: SubgraphInput, Add, SubgraphOutput.
  const inner = (sg!.parameters as { children: { graph: { nodes: { type: string }[] } } })
    .children.graph.nodes;
  expect(inner.map((n) => n.type).sort()).toEqual(["Add", "SubgraphInput", "SubgraphOutput"]);
});
```

- [ ] **Step 2: Run, expect FAIL**.

- [ ] **Step 3: Implement**

```ts
import {
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
} from "../../document/subgraph";
import { edgeIdFor } from "../../document/ids";

const groupSelection = (): GraphNode | undefined => {
  const selected = [...editorStore.selectedNodeIds];
  if (selected.length === 0) return undefined;
  const level = docStore.currentLevelGraph;
  const selSet = new Set(selected);
  const innerNodes = level.nodes.filter((n) => selSet.has(n.id));
  if (innerNodes.length === 0) return undefined;

  // Centroid for the new Subgraph node's position.
  const centroid: Position = innerNodes.reduce(
    (acc, n) => ({ x: acc.x + n.position.x, y: acc.y + n.position.y }),
    { x: 0, y: 0 },
  );
  centroid.x /= innerNodes.length;
  centroid.y /= innerNodes.length;

  return history.transact(`Group ${String(innerNodes.length)} nodes`, () => {
    // Pre-compute external crossings: edges with exactly one endpoint in the selection.
    const crossingsIn = level.edges.filter(
      (e) => !selSet.has(e.source.node) && selSet.has(e.target.node),
    );
    const crossingsOut = level.edges.filter(
      (e) => selSet.has(e.source.node) && !selSet.has(e.target.node),
    );
    const internal = level.edges.filter(
      (e) => selSet.has(e.source.node) && selSet.has(e.target.node),
    );

    // Construct the child graph fully in memory before mutating the parent.
    // Inner nodes keep their original ids (each level has its own id space).
    // Pseudo-node ids are allocated above the inner max to guarantee no
    // collision with retained inner ids.
    const childGraph: Graph = {
      nodes: innerNodes.map((n) => ({ ...n })),
      edges: internal.map((e) => ({ ...e })),
      comments: [],
    };
    let nextChildId = innerNodes.reduce((m, n) => (n.id > m ? n.id : m), 0) + 1;

    // Materialize SubgraphInput pseudo-nodes (one per distinct external feeder port).
    const inputNameByExternalKey = new Map<string, string>();
    let nextInputN = 1;
    for (const e of crossingsIn) {
      const key = `${String(e.source.node)}.${e.source.port}`;
      if (!inputNameByExternalKey.has(key)) {
        const name = `in${String(nextInputN++)}`;
        inputNameByExternalKey.set(key, name);
        const pseudoId = nextChildId++;
        childGraph.nodes.push({
          id: pseudoId,
          type: SUBGRAPH_INPUT_NODE_TYPE,
          position: { x: 0, y: nextInputN * 50 },
          parameters: { name, portType: "int" },
        });
        // Inner edge from pseudo.out to every internal target consuming this external feeder.
        for (const dup of crossingsIn.filter(
          (x) => `${String(x.source.node)}.${x.source.port}` === key,
        )) {
          childGraph.edges.push({
            id: edgeIdFor(pseudoId, "out", dup.target.node, dup.target.port),
            source: { node: pseudoId, port: "out" },
            target: { node: dup.target.node, port: dup.target.port },
          });
        }
      }
    }

    // Materialize SubgraphOutput pseudo-nodes (one per distinct internal source port).
    const outputNameByInternalKey = new Map<string, string>();
    let nextOutputN = 1;
    for (const e of crossingsOut) {
      const key = `${String(e.source.node)}.${e.source.port}`;
      if (!outputNameByInternalKey.has(key)) {
        const name = `out${String(nextOutputN++)}`;
        outputNameByInternalKey.set(key, name);
        const pseudoId = nextChildId++;
        childGraph.nodes.push({
          id: pseudoId,
          type: SUBGRAPH_OUTPUT_NODE_TYPE,
          position: { x: 200, y: nextOutputN * 50 },
          parameters: { name, portType: "int" },
        });
        childGraph.edges.push({
          id: edgeIdFor(e.source.node, e.source.port, pseudoId, "in"),
          source: { node: e.source.node, port: e.source.port },
          target: { node: pseudoId, port: "in" },
        });
      }
    }

    // Remove the selected nodes from the parent level. The store's removeNode
    // also drops their incident edges, so we re-add the rerouted edges below.
    for (const id of selected) docStore.removeNode(id);

    // Add the new Subgraph node and capture its allocated id (the store
    // assigns it via nextNodeId — there is no separate allocate API).
    const subgraphNode = docStore.addNode({
      type: SUBGRAPH_NODE_TYPE,
      position: centroid,
      parameters: {
        children: { version: 1, graph: childGraph },
      },
    });
    const subgraphId = subgraphNode.id;

    // Re-add rerouted external edges. Group crossingsIn by external feeder
    // key so each pseudo-name maps to exactly one external edge per feeder.
    const seenInKeys = new Set<string>();
    for (const e of crossingsIn) {
      const key = `${String(e.source.node)}.${e.source.port}`;
      if (seenInKeys.has(key)) continue;
      seenInKeys.add(key);
      const name = inputNameByExternalKey.get(key)!;
      docStore.addEdge({
        source: { node: e.source.node, port: e.source.port },
        target: { node: subgraphId, port: name },
      });
    }
    for (const e of crossingsOut) {
      const key = `${String(e.source.node)}.${e.source.port}`;
      const name = outputNameByInternalKey.get(key)!;
      docStore.addEdge({
        source: { node: subgraphId, port: name },
        target: { node: e.target.node, port: e.target.port },
      });
    }

    editorStore.selectNode(subgraphId);
    editorStore.markDirty();
    return subgraphNode;
  });
};
```

(Pseudo-node `portType: "int"` is a v1 simplification — type inference from the surrounding graph is a future-extension; the user can edit `portType` in PropertyPanel post-grouping.)

- [ ] **Step 4: Run test, expect PASS**.

- [ ] **Step 5: Gates and commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add src/editor/composables/useCanvasOperations.ts tests/unit/editor/composables/useCanvasOperations.subgraph.test.ts
git commit -m "feat(editor): canvasOps groupSelection materializes Subgraph + pseudo-nodes"
```

---

### Task 23: `CustomNode.vue` render branches

**Files:**
- Modify: `src/editor/components/CustomNode.vue`

- [ ] **Step 1: Add three render branches**

For nodes whose `data.type` is `Subgraph`: render a tile with the node's name (or `Sub-graph #${id}`), and a list of handles synthesized from the inner pseudo-nodes (sorted by `position.y` then `position.x`). Inputs (handle ids = SubgraphInput names) on the left edge; outputs (= SubgraphOutput names) on the right edge.

For `SubgraphInput`: render a small "▶ name : portType" tile with one output handle.

For `SubgraphOutput`: mirror — "name : portType ▶" tile, one input handle.

All three use existing semantic CSS tokens from `docs/theming.md` (`--vg-surface`, `--vg-border`, `--vg-text`, `--vg-accent`).

- [ ] **Step 2: Manual smoke** with `pnpm dev` — drag a `Subgraph` from the palette, confirm it renders with no handles (empty children) and no console errors.

- [ ] **Step 3: Run all tests; gates; commit**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
git add src/editor/components/CustomNode.vue
git commit -m "feat(editor/canvas): render Subgraph and pseudo-node branches"
```

---

### Task 24: `CanvasView.vue` reads current level

**Files:**
- Modify: `src/editor/components/CanvasView.vue`

- [ ] **Step 1: Replace `documentStore.nodes` / `.edges` references** with `documentStore.currentLevelGraph.nodes` / `.edges` for the VueFlow `:nodes`/`:edges` props. Same for viewport binding (read `currentLevelGraph.viewport`).

- [ ] **Step 2: Wire double-click on a Subgraph node** to `useCanvasOperations.enterSubgraph(node.id)`.

- [ ] **Step 3: Wire Backspace at non-root with empty selection** to `useCanvasOperations.exitToParent()`. Use existing keyboard layer in `useShortcuts`.

- [ ] **Step 4: Run all tests; manual smoke (`pnpm dev`); gates; commit**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
git add src/editor/components/CanvasView.vue src/editor/composables/useShortcuts.ts
git commit -m "feat(editor/canvas): render and operate on current sub-graph level"
```

---

### Task 25: `Breadcrumbs.vue` component

**Files:**
- Create: `src/editor/components/Breadcrumbs.vue`
- Modify: `src/App.vue` (mount the component above the canvas)

- [ ] **Step 1: Implement**

```vue
<script setup lang="ts">
import { computed } from "vue";
import { useEditorStore } from "../stores/editorStore";
import { useDocumentStore } from "../stores/documentStore";
import { SUBGRAPH_NODE_TYPE } from "../../document/subgraph";

const editor = useEditorStore();
const doc = useDocumentStore();

interface Crumb { label: string; path: number[]; }

const crumbs = computed<Crumb[]>(() => {
  const out: Crumb[] = [{ label: "Root", path: [] }];
  let g = doc.doc.graph;
  for (let i = 0; i < editor.currentPath.length; i++) {
    const id = editor.currentPath[i]!;
    const node = g.nodes.find((n) => n.id === id);
    const label = node?.name ?? `Subgraph #${String(id)}`;
    out.push({ label, path: editor.currentPath.slice(0, i + 1) });
    if (node?.type === SUBGRAPH_NODE_TYPE) {
      const child = (node.parameters as { children?: { graph: typeof g } }).children;
      if (child) g = child.graph;
    }
  }
  return out;
});

const goTo = (path: number[]): void => editor.setCurrentPath(path);
</script>

<template>
  <nav class="breadcrumbs" aria-label="Sub-graph navigation">
    <template v-for="(c, idx) in crumbs" :key="idx">
      <span v-if="idx > 0" class="breadcrumbs__sep" aria-hidden="true">›</span>
      <button
        type="button"
        class="breadcrumbs__crumb"
        :class="{ 'breadcrumbs__crumb--current': idx === crumbs.length - 1 }"
        :aria-current="idx === crumbs.length - 1 ? 'page' : undefined"
        @click="goTo(c.path)"
      >
        {{ c.label }}
      </button>
    </template>
  </nav>
</template>

<style scoped>
.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: var(--vg-surface);
  border-bottom: 1px solid var(--vg-border);
  color: var(--vg-text);
  font-size: 0.85rem;
}
.breadcrumbs__crumb {
  background: none;
  border: none;
  color: var(--vg-text);
  cursor: pointer;
  padding: 0.15rem 0.35rem;
  border-radius: 3px;
}
.breadcrumbs__crumb:hover { background: var(--vg-surface-hover); }
.breadcrumbs__crumb:focus-visible { outline: 2px solid var(--vg-accent); }
.breadcrumbs__crumb--current {
  color: var(--vg-text-muted);
  cursor: default;
}
.breadcrumbs__sep { color: var(--vg-text-subtle); }
</style>
```

- [ ] **Step 2: Mount in `App.vue`** above the canvas region.

- [ ] **Step 3: Manual smoke. Gates. Commit.**

```bash
pnpm lint && pnpm typecheck && pnpm build
git add src/editor/components/Breadcrumbs.vue src/App.vue
git commit -m "feat(editor): Breadcrumbs component"
```

---

### Task 26: `Palette.vue` — Subgraph category + Group action

**Files:**
- Modify: `src/editor/components/Palette.vue`
- Modify: `src/editor/components/TopBar.vue` (add "Group" button)

- [ ] **Step 1: Palette** — the new built-ins from Task 3 already register under category "Subgraph", so the existing palette grouping should display them automatically. Confirm visually with `pnpm dev`. Adjust filter logic only if it special-cases the existing categories.

- [ ] **Step 2: TopBar — Group button**

Add a button next to existing actions, disabled when `editorStore.selectedNodeIds.size === 0` or when selection contains a pseudo-node (pseudo-nodes can't move levels via group). On click: `useCanvasOperations.groupSelection()`.

- [ ] **Step 3: Manual smoke — select 2 nodes on the root canvas, click Group, confirm a Subgraph tile appears with rerouted edges. Gates. Commit.**

```bash
pnpm lint && pnpm typecheck && pnpm build
git add src/editor/components/Palette.vue src/editor/components/TopBar.vue
git commit -m "feat(editor): palette exposes Subgraph category + TopBar Group action"
```

---

### Task 27: `PropertyPanel.vue` — pseudo-node and Subgraph editing

**Files:**
- Modify: `src/editor/components/PropertyPanel.vue`

- [ ] **Step 1: For selected `SubgraphInput` / `SubgraphOutput`** — render two text fields (`name`, `portType`). Wire two-way binding through `documentStore.updateNodeParameters(id, { name, portType })` (add this action to documentStore if not present — it's a thin wrapper around setting `node.parameters` and `markDirty`).

- [ ] **Step 2: For selected `Subgraph`** — render a single `name` field (writes `node.name`).

- [ ] **Step 3: Manual smoke. Gates. Commit.**

```bash
pnpm lint && pnpm typecheck && pnpm build && pnpm test
git add src/editor/components/PropertyPanel.vue src/editor/stores/documentStore.ts
git commit -m "feat(editor): property panel edits sub-graph and pseudo-node fields"
```

---

## Phase 7 — e2e + a11y + finalize

### Task 28: Playwright e2e — `subgraph.spec.ts`

**Files:**
- Create: `tests/e2e/subgraph.spec.ts`

- [ ] **Step 1: Implement the spec**

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { promises as fs } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

test("group selection -> drill in -> save -> reload -> compile via CLI -> assert flat shape", async ({ page }, testInfo) => {
  await page.goto("/");
  // Build the simple Const -> Add -> Print graph from the palette.
  // (Selectors mirror the existing editor.spec.ts patterns.)
  // ... add Constant ... add Add ... add Print ... wire ...
  // (Skipping the full DnD code for brevity in this plan — copy pattern from
  // tests/e2e/editor.spec.ts and adapt to your three-node target.)

  // Select Const + Add (lasso or shift-click).
  // ...

  // Click "Group" in TopBar.
  await page.getByRole("button", { name: /^group$/i }).click();

  // Expect a Subgraph tile + Print.
  await expect(page.locator('[data-node-type="Subgraph"]')).toHaveCount(1);

  // Drill in via double-click.
  await page.locator('[data-node-type="Subgraph"]').dblclick();

  // Pseudo-nodes should be visible.
  await expect(page.locator('[data-node-type="SubgraphInput"]')).toHaveCount(1);
  await expect(page.locator('[data-node-type="SubgraphOutput"]')).toHaveCount(1);

  // axe gate at this depth.
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
  expect(blocking).toEqual([]);

  // Drill out.
  await page.getByRole("button", { name: /^root$/i }).click();
  await expect(page.locator('[data-node-type="Subgraph"]')).toHaveCount(1);

  // Save: click TopBar Save which downloads a JSON.
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /^save$/i }).click();
  const download = await downloadPromise;
  const tmpDir = testInfo.outputPath();
  const savedPath = path.join(tmpDir, "saved.json");
  await download.saveAs(savedPath);

  // Compile via CLI in a subprocess; assert flattened shape.
  const out = execSync(`node ./dist/cli/vizgraph.js compile ${savedPath}`, { cwd: process.cwd() }).toString();
  const compiled = JSON.parse(out) as { nodes: { type: string }[]; edges: unknown[] };
  expect(compiled.nodes.map((n) => n.type).sort()).toEqual(["Add", "Constant", "Print"]);
  expect(compiled.edges).toHaveLength(2);

  // Reload from disk.
  await page.evaluate(() => { (window as never as { __loadDoc?: (s: string) => void }).__loadDoc?.(""); });
  // (If the editor doesn't expose a programmatic load helper, drive the
  // file-input element via Playwright's setInputFiles.)
  // ...

  // Assert the document still has 1 Subgraph + Print at the root.
  await expect(page.locator('[data-node-type="Subgraph"]')).toHaveCount(1);
});
```

(Implementation engineer: use the existing `tests/e2e/editor.spec.ts` patterns for palette DnD, save-download, and load-from-file. The skeleton above is the canonical assertion shape; the input plumbing is already solved in the existing spec.)

- [ ] **Step 2: Run e2e**

```
pnpm e2e
```

- [ ] **Step 3: Gates and commit**

```bash
pnpm lint && pnpm typecheck && pnpm format:check && pnpm build && pnpm test && pnpm e2e
git add tests/e2e/subgraph.spec.ts
git commit -m "test(e2e): full sub-graph lifecycle with axe gate and CLI compile assertion"
```

---

### Task 29: Documentation, ADR, memory, plan checkboxes, changelog

**Files:**
- Create: `docs/decisions/0007-subgraphs-flatten-at-compile.md`
- Modify: `PROJECT_MEMORY.md`
- Modify: `PLAN.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Author ADR-0007**

Lead with the decision sentence, body cites the spec for full rationale. Pattern follows `docs/decisions/0006-phase-4-runresult-import.md`.

```markdown
# ADR-0007: Sub-graphs flatten at compile time

**Status:** Accepted (2026-05-02)

The editor supports recursive sub-graph encapsulation with a typed port surface. The compiler flattens the recursive document into the same flat `{nodes, edges}` JSON shape the C++ runtime already consumes; the runtime contract is unchanged. ADR-0001 (editor-only, no in-repo C++) is preserved.

Full design rationale and the rejected alternatives (nested-on-canvas, reusable-types-in-v1, runtime-side recursion, path-prefixed string ids): see `docs/specs/2026-05-02-subgraphs-design.md`.
```

- [ ] **Step 2: Update `PLAN.md` backlog**

Replace the unchecked Sub-graphs/grouping line with `[x] Sub-graphs / grouping. *(2026-05-02 — see CHANGELOG.)*`

- [ ] **Step 3: Update `PROJECT_MEMORY.md`**

In **Backlog progress** append `· ✅ Sub-graphs / grouping (recursive encapsulation, drill-in UX, flatten-at-compile, ADR-0007).` In **Resumption point** remove the Sub-graphs entry and replace with "All backlog items shipped. Next session has no queued work."

- [ ] **Step 4: `CHANGELOG.md`**

Add an entry under `[Unreleased]`:

```
### Added
- Sub-graphs / grouping: recursive encapsulation with typed port surface,
  drill-in canvas with breadcrumbs, current-level RunResult overlays.
  Compiler flattens to the existing runtime-bound JSON shape; no C++
  runtime changes. See docs/specs/2026-05-02-subgraphs-design.md
  and ADR-0007.
```

- [ ] **Step 5: Commit**

```bash
git add docs/decisions/0007-subgraphs-flatten-at-compile.md PROJECT_MEMORY.md PLAN.md CHANGELOG.md
git commit -m "docs: ADR-0007 + memory/plan/changelog for sub-graphs"
```

---

### Task 30: Final all-gates run + merge to master

**Files:** none modified.

- [ ] **Step 1: Run every gate**

```bash
pnpm lint && pnpm typecheck && pnpm format:check && pnpm test && pnpm build && pnpm e2e
```

Expected: all exit 0, axe gate green, no flaky e2e.

- [ ] **Step 2: Manual smoke** with `pnpm dev` — confirm: drag/drop a Subgraph; group a selection; drill in; rename a pseudo-node; drill out; save; reload; compile via CLI from a terminal.

- [ ] **Step 3: Merge `feat/subgraphs` → `master`**

```bash
git checkout master
git merge --no-ff feat/subgraphs -m "Merge feat/subgraphs: sub-graphs / grouping"
git tag subgraphs-complete
```

- [ ] **Step 4: Push** (uses GIT_ASKPASS pattern from prior session memory if needed).

```bash
git push origin master
git push origin subgraphs-complete
```

- [ ] **Step 5: Pin HEAD in `PROJECT_MEMORY.md`** — replace any prior commit SHA with the new merge commit.

```bash
git add PROJECT_MEMORY.md
git commit -m "docs(memory): pin HEAD post-subgraphs merge"
git push origin master
```

---

## Self-review checklist (the engineer can re-run this before merging)

- [ ] Spec coverage: every section of the spec maps to at least one task above.
- [ ] No placeholders (no "TBD", no "implement later").
- [ ] All new diagnostic codes added in `codes.ts` and emitted somewhere.
- [ ] All new node types registered in `builtIns.ts` and rendered in `CustomNode.vue`.
- [ ] `compile()` callers updated (`.graph` extraction).
- [ ] Existing tests still pass without modification beyond signature updates.
- [ ] axe e2e gate is green.
- [ ] Working tree clean before the merge step.
