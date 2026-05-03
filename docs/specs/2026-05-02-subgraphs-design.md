# Sub-graphs / grouping — design spec

**Date:** 2026-05-02
**Status:** Approved (brainstorming → spec phase)
**Supersedes:** none
**Related:** ADR-0001 (editor-only, no in-repo C++), ADR-0007 (this work; to be authored alongside implementation)
**Implementation plan:** to be written next via `superpowers:writing-plans`.

> This spec is the durable record of every architectural decision made during brainstorming. It is written to support future AI-assisted extension work — the **Future Extensions** section (§9) records the road *not* taken with enough detail to take it later, so a downstream agent can extend the design without re-deriving any of this.

---

## 1. Motivation and scope

### 1.1 Goal

Add **sub-graphs / grouping** to the n8n_port editor: the user can select a region of nodes and encapsulate them behind a typed port surface, producing a single tile on the canvas that hides the internals. This is the final remaining backlog item recorded in `PLAN.md`.

### 1.2 What this is and is not

This is **true sub-graph encapsulation** with a typed port surface — a sub-graph is a node-like construct that exposes named, typed inputs and outputs, internally connected to a self-contained graph of child nodes.

This is **not** visual grouping (a labeled frame with no semantic ports) and **not** a collapsible region (visual + UX only). Both alternatives were considered and rejected; rationale captured in §10.1.

### 1.3 The C++ runtime contract is unchanged

The external C++ DAG runtime described in `N8N_GRAPH_EDITOR_ADAPTATION_PROMPT.md` is **not** modified. Sub-graphs are an **editor-side abstraction only**: at compile time the compiler **flattens** the recursive document into the same flat `{nodes, edges}` JSON shape the runtime already consumes. The runtime never sees a sub-graph. ADR-0001 (editor-only, no in-repo C++) is preserved.

### 1.4 Scope decisions locked during brainstorming

| Question | Decision | Rejected alternatives |
|---|---|---|
| Encapsulation model | True sub-graph with typed port surface | Visual grouping only; collapsible region only |
| Reuse | One-off instances only (no reusable types in v1) | Reusable types; both/promote-to-type |
| Nesting | Unbounded recursion | Flat (1 level only); bounded cap |
| Port surface declaration | Explicit `SubgraphInput` / `SubgraphOutput` pseudo-nodes inside | Inferred from unconnected internals; metadata-only on group |
| View / navigation | Drill-in with breadcrumbs (one canvas at a time) | Nested-on-canvas inline expand; hybrid |
| RunResult overlays | Current-level-only (sub-graph tile shows nothing in Inspect mode) | Aggregate roll-up; v1 disables RunResult import for graphs containing sub-graphs |
| Schema versioning | Stay on `version: 1`, additive | Bump to `version: 2` |
| Compiler ID strategy | Renumber to fresh integer uids; emit reverse `idMap` | Path-prefixed string ids |

### 1.5 Backward compatibility

Documents that contain no `Subgraph` / `SubgraphInput` / `SubgraphOutput` nodes parse, validate, render, and compile **identically** to today. Legacy v1 import path is untouched.

---

## 2. Architecture overview

### 2.1 Three new built-in node types

Registered via the existing `NodeTypeRegistry` (`src/registry/`). Each is a conventional `GraphNode` (numeric id, position, parameters bag) — the recursion lives in *parameters*, not in the base node shape.

- **`Subgraph`** — container node. `parameters.children` is recursively a `GraphDocument`. On the canvas, displays as a tile with one inbound handle per inner `SubgraphInput` and one outbound handle per inner `SubgraphOutput`. Outer-face handle id = inner pseudo-node's `parameters.name`. Outer-face handle type = inner pseudo-node's `parameters.portType`.
- **`SubgraphInput`** — pseudo-node valid only inside a `Subgraph`. Single output handle (typed by `parameters.portType`), labeled by `parameters.name`. Semantic role: "this declares one entry on the parent's input port surface."
- **`SubgraphOutput`** — mirror of `SubgraphInput`. Single input handle.

Node-type strings `Subgraph`, `SubgraphInput`, `SubgraphOutput` are **reserved**. Plugin-registered external node types may not claim these names; the validator emits `reserved_node_type` if they do.

### 2.2 Module-by-module touch list

| Module | Change |
|---|---|
| `src/document/` | New file `subgraph.ts` with `SubgraphParametersSchema` (recursive via `z.lazy`) and `PseudoPortParametersSchema`. New file `subgraphChase.ts` with the shared pseudo-node chase helpers used by validator, compiler, and `canConnect`. **No change** to `types.ts`, `ids.ts`, `index.ts`, or the existing `GraphDocumentSchema`. |
| `src/registry/` | Register the three new built-in `NodeTypeDescription`s. |
| `src/serializer/` | **No code change** — Zod recursion handles save/load for free. Legacy JSON path unchanged. |
| `src/validator/` | New rule files (§5). Existing rules gain a `(graph, path)` argument so they recurse into every level; emit `path` in their diagnostics where applicable. New optional field `path?: number[]` on `Diagnostic`. |
| `src/compiler/` | `compile()` return shape changes from `CompiledGraph` to `CompiledOutput { graph: CompiledGraph, idMap: Map<string, number> }`. Recursive flatten with renumbered uids. CLI updated to take `.graph` (one-line change). |
| `src/editor/canConnect.ts` | Uses pseudo-node chase to derive effective `(srcType, dstType)` across boundaries. |
| `src/editor/stores/editorStore.ts` | Add `currentPath: number[]` and selectors. |
| `src/editor/stores/documentStore.ts` | `getCurrentLevel(): Graph` selector that resolves `currentPath` against `doc.graph` recursively. All canvas operations mutate the addressed level. |
| `src/editor/stores/clipboardStore.ts` | Scope copy/paste to current level only. |
| `src/editor/stores/historyStore.ts` | **No change** — snapshot history captures the recursive doc unchanged. |
| `src/editor/stores/executionStore.ts` | Entries keyed by full path string; canvas filters to current level. |
| `src/editor/composables/useCanvasOperations.ts` | Add `enterSubgraph(id)`, `exitToParent()`, `groupSelection()`. |
| `src/editor/components/CanvasView.vue` | Render the slice at `currentPath`; double-click on a `Subgraph` enters; Backspace with empty selection at non-root exits. |
| `src/editor/components/Breadcrumbs.vue` | New. |
| `src/editor/components/CustomNode.vue` | New render branches for the three node types. |
| `src/editor/components/Palette.vue` | New "Subgraph" category exposing the three types; "Group selection" action in TopBar / context menu. |
| `src/editor/components/PropertyPanel.vue` | Edit `name` / `portType` for pseudo-nodes; rename for `Subgraph`. |
| `tests/unit/` | Per-module Vitest mirroring above (§6). |
| `tests/e2e/subgraph.spec.ts` | One Playwright spec covering the full lifecycle (§6). |
| `docs/decisions/0007-subgraphs-flatten-at-compile.md` | New ADR. |
| `docs/plans/2026-05-02-subgraphs.md` | Implementation plan, written next via `superpowers:writing-plans`. |
| `PROJECT_MEMORY.md`, `PLAN.md`, `CHANGELOG.md` | Updated at end of phase. |

---

## 3. Schema (additive on `version: 1`)

### 3.1 No change to base schemas

`NodeSchema`, `EdgeSchema`, `GraphSchema`, `GraphDocumentSchema`, `EdgeEndpointSchema` are **unchanged**. New node types live entirely inside the existing permissive `parameters: Record<string, unknown>` field.

### 3.2 New per-type parameter schemas

```ts
// src/document/subgraph.ts (new file)
import * as z from "zod";
import { GraphDocumentSchema, type GraphDocument } from "./types";

// Recursive: parameters.children is itself a GraphDocument.
export const SubgraphParametersSchema: z.ZodType<{
  children: GraphDocument;
}> = z.object({
  children: z.lazy(() => GraphDocumentSchema),
});

// Pseudo-node parameters: name + portType. portType uses the same string
// identifiers the rest of the registry uses for typed handles.
export const PseudoPortParametersSchema = z.object({
  name: z.string().min(1),
  portType: z.string().min(1),
});

export const SUBGRAPH_NODE_TYPE = "Subgraph";
export const SUBGRAPH_INPUT_NODE_TYPE = "SubgraphInput";
export const SUBGRAPH_OUTPUT_NODE_TYPE = "SubgraphOutput";
```

### 3.3 Why parse stays tolerant; validator tightens

`NodeSchema.parameters` is already `Record<string, unknown>`. Making `NodeSchema` a discriminated union over `type` would force every existing node type to declare a typed-parameters variant — a major refactor for no gain. Instead:

- `serializer.parse()` uses the existing `GraphDocumentSchema` and continues to accept any node-type with any `parameters` shape. Files load.
- The **validator** runs the strict per-type Zod parses (`SubgraphParametersSchema`, `PseudoPortParametersSchema`) on each node's `parameters`. Any structural error becomes a `Diagnostic` with a stable `code` (§5).

This matches the existing rule-based validation pattern.

### 3.4 Node id scoping

Each `GraphDocument` has its own integer id space (`nextNodeId(doc)` operates on `doc.graph.nodes`). Sub-graph internals use their own per-level ids; no global uniqueness requirement at edit time. Compiler reconciles to globally-unique uids (§4).

### 3.5 Edge endpoints stay numeric and same-level

`EdgeEndpoint.node: number` references a node id at the **same level** as the edge. Edges never cross level boundaries — the boundary is mediated entirely by `SubgraphInput`/`SubgraphOutput` pseudo-nodes. The edge schema is unchanged.

### 3.6 Outer-face port id convention

When a `Subgraph` node is the source or target of an edge, the `EdgeEndpoint.port` string equals the `parameters.name` of the corresponding pseudo-node inside the sub-graph. Validator enforces this binding (`subgraph_port_unbound`).

### 3.7 Outer-face handle order

Determined at render time by sorting pseudo-nodes by `position.y` ascending, ties broken by `position.x`. Stable, intuitive, requires no extra schema field. The user gets WYSIWYG control over port order by arranging pseudo-nodes vertically inside the sub-graph.

### 3.8 Schema version

Stay on `version: 1`. The change is additive — new node types in an existing flat node list. ADR-0007 records this choice. Future-ext notes (§9.6) cover the v2 path if it's ever needed.

---

## 4. Compiler (recursive flatten)

### 4.1 Return-shape change

```ts
export interface CompiledOutput {
  graph: CompiledGraph;          // unchanged shape — what the runtime sees
  idMap: Map<string, number>;    // editor-only — path key → uid
}

export const compile = (doc: GraphDocument): CompiledOutput => { /* ... */ };
```

Existing callers update to `compile(doc).graph`. The CLI (`vizgraph` binary) writes only `output.graph` — runtime payload is byte-for-byte identical to today for documents that contain no sub-graphs.

### 4.2 Path keys

`idMap` keys are slash-joined integer ids: `"42/7/3"` = "node id 3, inside sub-graph 7, inside sub-graph 42, at the root." Slash separator is safe because ids are integers — no collisions possible.

### 4.3 Why integer uids, not path-prefixed strings

`CompiledNode.uid: number` is dictated by the C++ runtime contract. Path-prefixed strings would require a runtime change (rejected per ADR-0001). Renumbering preserves the contract.

DFS order is deterministic ⇒ `compile()` is a pure function, same input always produces the same `CompiledOutput` byte-for-byte.

### 4.4 Pass 1 — collect real nodes

DFS through the document tree, parent's `nodes` array order, recursing into `Subgraph.parameters.children.nodes` in array order:

- If `node.type === "Subgraph"` → skip emission, recurse into `parameters.children`. Container has no runtime counterpart.
- If `node.type === "SubgraphInput"` or `"SubgraphOutput"` → skip emission. Pseudo-nodes are port-surface declarations, not runtime nodes.
- Otherwise → allocate next uid (monotonic counter starting at 1), emit a `CompiledNode`, record `idMap.set(pathKey, uid)`. Existing `Constant.value` validation and `frequency_hz` propagation logic is preserved unchanged in this step.

### 4.5 Pass 2 — resolve edges via pseudo-node chasing

Two helpers in `src/document/subgraphChase.ts` (shared with validator and `canConnect`).

By the schema, **only regular nodes can be edge sources at runtime** — `SubgraphInput` (no input handle) cannot be a target, `SubgraphOutput` (no output handle) cannot be a source. Each port has at most one feeding source by convention (fan-in into a single input port is rejected by the existing port-uniqueness rules). Therefore:

- `resolveSource` is **single-valued**: each junction has exactly one feeder upstream.
- `resolveTarget` is **multi-valued** (returns a *set*): fan-out from a junction can produce many downstream consumers.

```ts
// Both walk through any number of pseudo-node / Subgraph-container hops
// until they land on regular (non-pseudo, non-Subgraph) nodes.
resolveSource(level, path, endpoint): { uid: number, port: string } | null
resolveTarget(level, path, endpoint): Array<{ uid: number, port: string }>
```

Rules for `resolveSource`:

1. `endpoint.node` is a regular node at this level → return `{ uid: idMap.get(pathKey), port: endpoint.port }`. Done.
2. `endpoint.node` is a `Subgraph` container → descend into `parameters.children`; find the `SubgraphOutput` pseudo-node with `parameters.name === endpoint.port`; find the inner edge that targets that pseudo-node; recurse on that edge's `source`.
3. `endpoint.node` is a `SubgraphInput` pseudo-node → ascend to the parent level; find the parent's `Subgraph` node owning this level; find the parent edge whose target matches `(parentSubgraphNodeId, pseudoNode.parameters.name)`; recurse on that edge's `source`.

Rules for `resolveTarget` (mirror, but multi-valued):

1. `endpoint.node` is a regular node at this level → return `[{ uid, port }]` (singleton).
2. `endpoint.node` is a `Subgraph` container → descend; find the `SubgraphInput` with matching name; for **every** inner edge whose source is that pseudo-node, recurse on that edge's `target`; flatten and return the union.
3. `endpoint.node` is a `SubgraphOutput` pseudo-node → ascend; find the parent's `Subgraph` node; for **every** parent edge whose source is `(parentSubgraphNodeId, pseudoNode.parameters.name)`, recurse on that edge's `target`; flatten and return the union.

Both return `null` / `[]` only when a chase hits a dangling pseudo-node — that case is caught earlier by the validator (`subgraph_port_unbound` / `subgraph_input_unconnected` / `subgraph_output_unconnected`); the compiler treats null/empty returns as a thrown invariant (belt-and-suspenders).

### 4.6 Edge emission

**Canonical emission rule, single source of truth:** emit a `CompiledEdge` *only* at edges whose `source.node` references a **regular** node (not a `Subgraph` container, not a pseudo-node). For each such edge, emit **one `CompiledEdge` per element** of `resolveTarget(level, path, edge.target)`.

Walk every edge at every level in the document tree:

- Source = regular node → emit one `CompiledEdge` per resolved target. Targets that route through a `Subgraph` or pseudo-node are correctly fanned out by the multi-valued chase.
- Source = `Subgraph` container → **skip**; the canonical emission lives at the inner edge from a `SubgraphOutput`'s feeder.
- Source = `SubgraphInput` pseudo-node → **skip**; the canonical emission lives at the *outer* edge whose target is the `Subgraph` container's matching port.
- Source = `SubgraphOutput` → impossible by schema (no output handle).

This rule guarantees each runtime edge is emitted **exactly once**, regardless of how many pseudo-node / `Subgraph`-container hops the corresponding "logical" path traverses. Fan-out across boundaries is correct via the multi-valued `resolveTarget`.

**Worked example** (round-trip through one sub-graph):

- Outer: `Const --> Subgraph.x`, `Subgraph.y --> Print`.
- Inner: `SubgraphInput(x) --> Add.lhs`, `Add.out --> SubgraphOutput(y)`.
- Emission walk:
  - `Const --> Subgraph.x` (source=Const, regular): emit. `resolveTarget` descends → `SubgraphInput("x")` → fans to inner edges → `Add.lhs`. Emits `Const → Add.lhs`.
  - `Subgraph.y --> Print` (source=Subgraph): skip.
  - `SubgraphInput(x) --> Add.lhs` (source=pseudo): skip.
  - `Add.out --> SubgraphOutput(y)` (source=Add, regular): emit. `resolveTarget` chases `SubgraphOutput("y")` → ascends → parent edge `Subgraph.y --> Print` → `Print`. Emits `Add.out → Print`.
- Runtime output: `Const → Add.lhs`, `Add.out → Print`. ✓ No double-emit.

**Fan-out example** (one inner consumer feeds two outer sinks):

- Outer: `Subgraph.y --> Print1`, `Subgraph.y --> Print2`.
- Inner: `Add.out --> SubgraphOutput(y)`.
- Walk emits at `Add.out --> SubgraphOutput(y)` once; `resolveTarget` returns `[Print1, Print2]`; emit `Add.out → Print1` and `Add.out → Print2`. ✓

### 4.7 Determinism guarantees

- DFS uses parent's `nodes` array order recursively.
- uid allocation is monotonic from 1.
- Edge emission walks `edges` arrays in declaration order at each level.
- Same input ⇒ same `CompiledOutput`, byte-for-byte.

---

## 5. Validator

### 5.1 Diagnostic shape — additive change

```ts
export const DiagnosticSchema = z.object({
  severity: z.enum(["error", "warning"]),
  code: z.string(),
  message: z.string(),
  node_id: z.number().int().optional(),
  edge_id: z.string().optional(),
  field: z.string().optional(),
  path: z.array(z.number().int()).optional(),  // NEW: chain of Subgraph node ids from root to the level of the offending element
});
```

`path` is optional and defaults to root level. Existing rules emit no `path`. Rules that traverse sub-graphs emit it. Backward-compatible (additive optional field).

### 5.2 Traversal change

Today `validate(doc)` runs each rule once over `doc.graph`. With sub-graphs, the validator runs **every existing rule over every reachable level** — root plus each `Subgraph.parameters.children` recursively. The traversal helper passes `(graph, path)` to each rule; rules that emit `node_id` / `edge_id` set `path` to the level path.

This means existing rules (`MISSING_REQUIRED_PORT`, `INVALID_TARGET_PORT`, `ISOLATED_NODE`, etc.) automatically apply inside sub-graphs without modification — only their argument signature changes.

### 5.3 New rule files

| Rule file | Codes | Severity | Trigger |
|---|---|---|---|
| `reservedNodeTypeRule.ts` | `reserved_node_type` | error | A registered `NodeTypeDescription` claims one of `Subgraph`, `SubgraphInput`, `SubgraphOutput`. |
| `subgraphSchemaRule.ts` | `subgraph_invalid_parameters` | error | `node.type === "Subgraph"` but `parameters` fails `SubgraphParametersSchema.safeParse`. `field` carries the failing key. |
| `subgraphSchemaRule.ts` | `pseudo_node_invalid_parameters` | error | Same idea for `SubgraphInput` / `SubgraphOutput` against `PseudoPortParametersSchema`. |
| `subgraphPlacementRule.ts` | `pseudo_node_at_root` | error | `SubgraphInput`/`SubgraphOutput` exists at root level (path is empty). |
| `subgraphPortRules.ts` | `pseudo_node_duplicate_name` | error | Two pseudo-nodes in the same level share `parameters.name` (across both directions — outer-face port ids are unique). |
| `subgraphPortRules.ts` | `subgraph_port_unbound` | error | Parent edge references `(subgraphNodeId, "foo")` but no pseudo-node inside has `parameters.name === "foo"`. |
| `subgraphPortRules.ts` | `subgraph_port_type_mismatch` | error | Cross-boundary type clash. Computed by chasing through pseudo-nodes (shared `subgraphChase.ts` helper) to derive effective `(srcType, dstType)`, then comparing. Distinct code (clearer error message) but same comparator as the existing port-type rule. |
| `subgraphConnectivityRule.ts` | `subgraph_input_unconnected` | warning | `SubgraphInput` pseudo-node has no internal consumer. |
| `subgraphConnectivityRule.ts` | `subgraph_output_unconnected` | warning | `SubgraphOutput` pseudo-node has no internal source. |
| `subgraphConnectivityRule.ts` | `empty_subgraph` | warning | `Subgraph.parameters.children.nodes` is empty. |

### 5.4 Existing rule interactions

- **`ISOLATED_NODE`** does **not** fire on `Subgraph` containers, `SubgraphInput`, or `SubgraphOutput`. The first is connectivity-checked by uniqueness/type rules on its outer-face ports. Pseudo-nodes are connectivity-checked by `subgraph_input_unconnected` / `subgraph_output_unconnected`, which carry clearer codes for the equivalent concern.
- **`MISSING_REQUIRED_PORT`, `INVALID_TARGET_PORT`** etc. recurse naturally into sub-graphs via the new `(graph, path)` argument; no rule-specific change needed.

### 5.5 `canConnect.ts`

Drag-to-connect validation runs the same `subgraphChase.ts` chase to derive cross-boundary type compatibility before the user lets go of the mouse. Reuse the shared helper to keep validator and live-connect logic consistent.

---

## 6. Editor / UX

### 6.1 Stores

- **`editorStore.currentPath: number[]`** — `Subgraph` node-id chain from root to currently-viewed level. `[]` = root.
- **`documentStore.getCurrentLevel(): Graph`** — selector that resolves `currentPath` against `doc.graph` recursively and returns the `Graph` at that level. All canvas operations (add/move/connect/delete/group) mutate the level addressed by `currentPath`.
- **`historyStore`** — **no change**. Snapshot history captures the whole `doc` (recursive). Undo/redo restores the entire tree, including the `currentPath`'s effective level.
- **`clipboardStore`** — copy/paste scoped to current level only. Cross-level paste is explicitly out of scope for v1; documented in §9.4.
- **`executionStore`** — entries keyed by full path string (`"42/7/3"`). Canvas filters to entries whose path key matches `currentPath`. Sub-graph tile in Inspect mode: dim, no overlay (current-level-only semantics, §9.3 covers aggregation).

### 6.2 Canvas

- **`CanvasView.vue`** — `:nodes="currentLevel.nodes"`, `:edges="currentLevel.edges"`. Double-click on a `Subgraph` node → `enterSubgraph(id)`. Backspace at non-root with empty selection → `exitToParent()`.
- **`CustomNode.vue`** — three new render branches:
  - `Subgraph`: bordered tile with name; outer-face handles materialized from inner pseudo-nodes (sorted by §3.7).
  - `SubgraphInput`: single right-side output handle, name + portType label.
  - `SubgraphOutput`: single left-side input handle, name + portType label.
- **`Breadcrumbs.vue`** (new) — bar above the canvas. Renders `Root › <Subgraph.name | "Subgraph #id"> › …` as clickable segments. Click a segment → set `currentPath` to that prefix. Always visible (even at root, just shows `Root`) so the affordance is discoverable.
- **`Palette.vue`** — new "Subgraph" category exposing the three node types. "Group selection" action lives in TopBar / canvas context menu. Keyboard shortcut deferred (Ctrl+G conflicts with browser bookmark search; consistent with the existing browser-default policy from Phase 3).
- **`PropertyPanel.vue`** — selected pseudo-node: edit `parameters.name` and `parameters.portType`. Selected `Subgraph`: rename. Inline; no modal.

### 6.3 Composables

- **`useCanvasOperations.enterSubgraph(id)`** — push `id` onto `editorStore.currentPath`. No history entry (navigation, not mutation).
- **`useCanvasOperations.exitToParent()`** — pop `currentPath`. No-op at root.
- **`useCanvasOperations.groupSelection()`** — single transactional `history.transact("Group N nodes into sub-graph", …)`:
  1. Compute selection centroid for the new `Subgraph` node's position.
  2. Create the new `Subgraph` node at the parent level with a fresh id and an empty `children` graph.
  3. Move selected nodes (and edges fully internal to the selection) into `children.nodes` / `children.edges`.
  4. For each parent edge that crossed *into* the selection: materialize a `SubgraphInput` inside the new sub-graph (one per distinct external source-port, named after the source port id with deduplication), rewrite the parent edge to target `(newSubgraphNodeId, pseudoName)`, add an inner edge from the pseudo-node's output handle to the original internal target.
  5. For each parent edge that crossed *out* of the selection: mirror logic with `SubgraphOutput`.

### 6.4 Per-level viewport

`GraphSchema.viewport` is already optional and per-`Graph`. Recursion gives free per-level viewport persistence — drilling into a sub-graph and back restores its previous pan/zoom.

### 6.5 A11y / theme

- All new components use the existing semantic CSS tokens from the dark-theme work (`docs/theming.md`). No new color literals.
- `Breadcrumbs.vue` segments are `role="link"` (or actual `<button>`s) with visible focus rings.
- `axe` e2e gate must stay green; spec includes axe checks at the canvas level after drilling in.

---

## 7. Tests

### 7.1 Vitest unit (mirrored under `tests/unit/`)

| Test file | Covers |
|---|---|
| `document/subgraph.test.ts` | Zod parse round-trip for new schemas; recursion correctness; structural rejection of malformed `parameters`. |
| `document/subgraphChase.test.ts` | `resolveSource` / `resolveTarget` across pseudo-nodes, multiple levels, fan-out, dangling cases. |
| `compiler/compile.subgraph.test.ts` | Flatten correctness on: simple sub-graph, nested sub-graph, fan-out from `SubgraphInput`, multiple `SubgraphOutput`s, deterministic uid allocation, `idMap` shape. |
| `validator/subgraphSchemaRule.test.ts` | One assertion per `subgraph_invalid_parameters` / `pseudo_node_invalid_parameters` trigger. |
| `validator/subgraphPlacementRule.test.ts` | `pseudo_node_at_root`. |
| `validator/subgraphPortRules.test.ts` | `pseudo_node_duplicate_name`, `subgraph_port_unbound`, `subgraph_port_type_mismatch`. |
| `validator/subgraphConnectivityRule.test.ts` | `subgraph_input_unconnected`, `subgraph_output_unconnected`, `empty_subgraph`. |
| `validator/recursion.test.ts` | Existing rules (e.g., `MISSING_REQUIRED_PORT`) recurse correctly into sub-graphs and emit `path`. |
| `editor/composables/useCanvasOperations.subgraph.test.ts` | `enterSubgraph` / `exitToParent` / `groupSelection` happy paths and history round-trips. |
| `editor/canConnect.subgraph.test.ts` | Drag-to-connect refuses cross-boundary type clash. |

All existing tests stay green. Total target: ~12 new test files.

### 7.2 Playwright e2e — single new file `tests/e2e/subgraph.spec.ts`

End-to-end lifecycle in one spec:

1. Build a flat 3-node graph (Constant → Add → Print).
2. Select Constant + Add.
3. Trigger "Group selection."
4. Assert the canvas now shows the new Subgraph tile + Print, with the right wiring.
5. Drill in via double-click.
6. Verify: pseudo-nodes were materialized (one `SubgraphInput`, one `SubgraphOutput`).
7. Drill out via breadcrumb.
8. Save the document via the existing TopBar Save flow.
9. Reload from disk.
10. Assert document equality.
11. Compile via the CLI (`vizgraph compile`) in a child process.
12. Assert flattened JSON has 3 real nodes (Constant, Add, Print) and the right edges.

### 7.3 axe gate

Same as today; the spec must include axe checks after drilling in to confirm the breadcrumb + sub-graph canvas pass WCAG 2.1 AA. No regression allowed.

---

## 8. Migration / rollout

### 8.1 Version bump

None. Schema stays at `version: 1`. Old documents continue to load and behave identically (§1.5).

### 8.2 Phase boundaries

This work fits one feature branch (`feat/subgraphs`) with the existing conventional-commit phase pattern. Tagged `subgraphs-complete` on merge. `CHANGELOG.md` entry mirrors prior backlog items.

### 8.3 Pre-existing CLI

`vizgraph compile` updates to take `compile(doc).graph` instead of `compile(doc)`. One-line change. Old CLI input documents (no sub-graphs) produce identical output.

### 8.4 Pre-existing plugins

Plugin-registered external node types must avoid the three reserved type strings. The validator catches collisions at registry load via `reserved_node_type`. No runtime breakage.

---

## 9. Future Extensions Catalog

Each entry: what to build, where to start, what changes, what's *not* lost from this v1. Designed so a future AI agent (or human) can extend without re-deriving any of this.

### 9.1 Reusable sub-graph types (Q2 path A → C)

**What:** Promote a one-off sub-graph to a reusable "custom node type." Define an "Adder" sub-graph once, drop N instances of it.

**Schema delta:** Add a top-level `subgraphTypes: Record<string, GraphDocument>` to `GraphDocument` (additive). Promote `Subgraph.parameters` to a discriminated union: either inline (current v1 shape, `{ children: GraphDocument }`) OR `{ typeRef: string }`.

**Validator delta:** Add cycle detection across `subgraphTypes` (a type can't transitively reference itself). One new diagnostic code: `subgraph_type_cycle`.

**Compiler delta:** When flattening a `typeRef`, clone the referenced `GraphDocument` and recurse. uid allocation continues; idMap path keys for instances might use a `(instanceId, typeId, localId, ...)` form — recorded as a sub-extension when implemented.

**UX delta:** "Promote to type" action in the property panel for a selected `Subgraph`. Type library section in the palette. "Edit type definition" action that drills into the type's definition (uses existing breadcrumb infra; breadcrumb shows `Type: <name> › …`).

**What's preserved from v1:** Drill-in UX, pseudo-node port-surface declaration, recursive flatten, `idMap` reverse lookup, current-level-only RunResult overlays.

### 9.2 Bounded depth cap

**What:** Reject documents nested deeper than N levels.

**Where:** New rule `subgraphDepthRule.ts` running on root only. Diagnostic code `subgraph_max_depth_exceeded`. ~10 lines.

**What's preserved:** Recursion, flatten, validator architecture.

### 9.3 RunResult overlay aggregation (Q6 path A → B)

**What:** Sub-graph tile shows aggregate run stats in Inspect mode (total duration, error badge if any internal errored, success otherwise).

**Where:** Derived selector `executionStore.aggregateAtPath(path)` returning `{ duration: sum, hasError: any, nodeCount }`. `CustomNode.vue`'s Subgraph branch renders the aggregate in Inspect mode.

**Precedence rule:** any error → error tile; else success; max duration shown (or sum, design choice at implementation time).

**What's preserved:** path-keyed `executionStore` from v1, current-level-only overlays for non-sub-graph nodes.

### 9.4 Cross-level copy-paste

**What:** Copy a selection at level A, paste at level B (different sub-graph or root).

**Where:** `clipboardStore` records the source-level path. On paste, walk the copied subtree and reallocate ids using `nextNodeId` per destination level.

**Edge handling:** edges fully internal to the copied selection are preserved (with reallocated ids); edges that crossed the selection boundary are dropped.

**What's preserved:** v1's same-level clipboard semantics.

### 9.5 Explicit pseudo-node ordering

**What:** User-controlled outer-face port order, decoupled from inner Y-position.

**Where:** Add `parameters.order: number` to `PseudoPortParametersSchema`. Switch sort key in `CustomNode.vue` Subgraph branch from `position.y` to `order`. PropertyPanel exposes an order field.

**What's preserved:** existing position-based default for users who don't care.

### 9.6 Schema v2 migration path

**What:** If a breaking change ever lands.

**Where:** Bump `GraphDocumentSchema.version` to `z.literal(2)`. Add a `version: 1 → 2` migration in `src/serializer/`. The recursive sub-graph concept and pseudo-node types survive a version bump unchanged — they're additive on the *node* schema, not the document shape.

**Trigger condition:** any change that breaks parse on a v1 file (e.g., changing the meaning of an existing field). Pure additions don't need a bump.

### 9.7 Group-on-canvas inline view (Q5 path A → B)

**What:** Optional second visualization mode: Subgraph rendered as a resizable frame on the parent canvas with internals visible inside.

**Where:** Use VueFlow's parent-node feature. Toggle in TopBar between "Drill-in" (canonical) and "Inline" view modes. Drill-in remains the canonical edit mode; Inline is a read-mostly view.

**What's preserved:** all of v1; this is purely additive.

---

## 10. Decision rationale (for the curious / for AI extension agents)

This section records *why* each architectural choice was made, so a future agent can judge whether the constraint still applies before extending.

### 10.1 Why true encapsulation, not visual grouping

Visual grouping is a 1-day add-on (a labeled frame). True encapsulation is a 1-week feature. We chose true encapsulation because the editor's value to the user is **producing a versioned JSON graph** — encapsulation gives reuse-of-effort (collapse a noisy region behind a typed interface), which is the actual UX win. Visual grouping is decoration.

### 10.2 Why one-off, not reusable types

Reuse is genuinely useful but doubles the design surface (definition lifecycle, instance binding, edit-the-definition UX, cycle detection across types). For an editor whose primary value is *visualizing and authoring* a DAG, the encapsulation/cleanup win comes mostly from one-offs. Reuse is a strict superset; promoting one-offs to types later is additive (§9.1), not a rewrite.

### 10.3 Why unbounded nesting

Recursion costs are paid once nesting is allowed *at all*. Adding a depth cap is a one-line validator rule (§9.2) we can drop in if pathological cases arise. Stack-overflow concerns are negligible at hand-author scale.

### 10.4 Why explicit pseudo-nodes, not inferred ports

Inferred ports re-derive the port surface every time a wire is dragged. Connect a node and a port silently vanishes from the outer face — and any external edge that used it breaks. That's the kind of bug a graph editor cannot afford. Explicit pseudo-nodes are stable: they only change when the user explicitly adds/removes/edits one.

Pseudo-nodes also inherit all canvas affordances for free (drag, configure, wire) — no new modality.

### 10.5 Why drill-in, not nested-on-canvas

One VueFlow canvas at a time. With unbounded nesting (§10.3), nested-on-canvas blows out viewport math, drag clamping, and edge routing at every level. Drill-in pays zero such cost. Mental model also matches the recursive data structure — drilling renders the inner `GraphDocument` directly, instead of faking a flattened view.

### 10.6 Why current-level-only RunResult overlays, not aggregation

Honest semantics: the runtime did N independent operations. Aggregation forces an answer to the question "what does the tile show when one inner errored and another succeeded?" — which we can defer (§9.3). Aggregation is a strict superset of current-level-only — A → B is additive.

### 10.7 Why renumbered integer uids, not path-prefixed strings

The C++ runtime expects integer node ids per ADR-0001 (we don't modify the runtime). The cost is bookkeeping (`idMap`), which is small. Path-prefixed strings would propagate through the runtime contract and require runtime changes — ruled out.

### 10.8 Why additive on `version: 1`, not a v2 bump

The change is genuinely additive: no existing field semantics change, no existing rule's behavior changes. Bumping for an additive change costs migration code without buying anything. v2 is reserved for the day a *breaking* change is genuinely needed (§9.6).

---

## 11. Open questions

None block implementation. All design forks are resolved.

If implementation surfaces a new question, it goes in `PROJECT_MEMORY.md`'s open-questions section and is referenced from this spec.

---

## 12. Implementation handoff

Next step: invoke `superpowers:writing-plans` to produce `docs/plans/2026-05-02-subgraphs.md` — a phased, executable plan with checkboxes mapping to the module-by-module touch list (§2.2) and the test inventory (§7).
