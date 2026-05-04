# vizgraph — Wire-Format Contract

> Authoritative specification of every JSON shape that crosses the
> vizgraph boundary. Anything in this file is contract; anything not in
> this file is implementation detail and may change.
>
> Source of truth (Zod schemas) lives under `src/document/`,
> `src/registry/types.ts`, `src/validator/diagnostics.ts`, and
> `src/compiler/compile.ts`. Where this doc and the code disagree, the
> code wins — please open an issue noting the drift.

## 0 · Index

| Format | Direction | Schema location | Versioning |
|---|---|---|---|
| **Versioned `GraphDocument`** | read + write | `src/document/types.ts#GraphDocumentSchema` | `version: 1` (literal) |
| **Legacy graph** | read-only | `src/serializer/legacy.ts#LegacyShapeSchema` | unversioned |
| **Compiled runtime JSON** | write-only (CLI / Save+compile) | `src/compiler/compile.ts#CompiledGraph` | unversioned (matches legacy) |
| **`RunResult`** | read-only (Inspect mode) | `src/document/runresult.ts#RunResultSchema` | `version: 1` (literal) |
| **`NodeTypeDescription`** | code-level (plugin registration) | `src/registry/types.ts#NodeTypeDescriptionSchema` | unversioned |
| **`Diagnostic`** | write-only (validator output) | `src/validator/diagnostics.ts#DiagnosticSchema` | unversioned |

JSON in all formats is UTF-8. Property ordering is **not** semantic —
parsers must not depend on it. The editor's `saveVersioned` uses
`JSON.stringify(doc, null, 2)` so files round-trip pretty-printed; this
is convention only.

---

## 1 · Versioned `GraphDocument` (canonical)

The shape produced by **Save** and the shape required by **Open**. Also
the shape the validator and compiler accept.

### 1.1 Top-level

```ts
{
  version: 1,           // literal; reject other values
  graph: Graph
}
```

### 1.2 `Graph`

```ts
{
  nodes: Node[],          // required, may be empty
  edges: Edge[],          // required, may be empty
  viewport?: Viewport,    // optional; remembered between sessions when present
  comments: Comment[]     // required; defaults to [] when reading; always emitted on save
}
```

`comments` is required *on output* but Zod accepts an absent field on
*input* and substitutes `[]`. Documents pre-dating the comments feature
(2026-05-02) load cleanly without modification.

### 1.3 `Node`

```ts
{
  id: number,                           // integer; unique within enclosing graph
  name?: string,                        // optional human label
  type: string,                         // matches a NodeTypeDescription.type
  position: { x: number, y: number },   // editor-only; required, no default
  parameters: Record<string, unknown>,  // shape determined by NodeTypeDescription.parameters
  frequency_hz?: number | null          // optional positive number; null is allowed and means "unset"
}
```

Notes:

- `id` is integer. Allocator policy is "max + 1 within graph"; consumers
  may supply any integers, including negatives, but uniqueness must hold
  within the same enclosing graph (not globally — see §2.6).
- `position` exists only for the editor; the runtime compile step drops
  it. External producers may set `{ x: 0, y: 0 }` if they have no
  layout — the editor's `Tidy` button will assign a Dagre layout on
  first interaction.
- `parameters` defaults to `{}` if absent on input. Per-type
  expectations live in `NodeTypeDescription.parameters`.
- `frequency_hz`, when present and not `null`, must be `> 0`. The
  validator emits `invalid_frequency` for `<= 0`.

### 1.4 `Edge`

```ts
{
  id: string,                                   // canonical form: e<src>_<srcPort>__<dst>_<dstPort>
  source: { node: number, port: string },
  target: { node: number, port: string }
}
```

Edge `id` is editor-only and is recomputed by the compiler. External
producers should follow the canonical form so that round-trips through
the editor don't churn. Edge ids must be unique within the enclosing
graph; the validator emits `duplicate_edge_id` otherwise.

### 1.5 `Viewport`

```ts
{ x: number, y: number, zoom: number }   // zoom > 0
```

Editor-only. Optional. Dropped by the compiler.

### 1.6 `Comment`

```ts
{
  id: string,                                            // editor-allocated; format c<n>
  text: string,
  position: { x: number, y: number },
  size?: { width: number, height: number },              // both > 0 when present
  color?: string,                                        // free-form; convention is CSS hex/name
  attachedTo?: { node?: number, edge?: string }         // when set, comment is anchored
}
```

Comments are editor-only annotations. The compiler always strips them;
they never reach the runtime. `attachedTo` is additive (added 2026-05-04,
no schema-version bump). Anchored comments follow node moves and
auto-detach when the anchor is removed.

### 1.7 Sub-graphs (special node types)

Sub-graphs are encoded as ordinary nodes whose `type` is one of three
reserved strings. External producers may emit them, but the validator
will reject malformed structure.

#### 1.7.1 `Subgraph` container node

```ts
{
  id: number,
  type: "Subgraph",
  position: { x, y },
  parameters: {
    children: GraphDocument         // recursive; same top-level shape
  }
}
```

The `children` field is itself a fully-formed `GraphDocument` (with its
own `version: 1`). Nesting may be arbitrarily deep.

#### 1.7.2 `SubgraphInput` and `SubgraphOutput` pseudo-nodes

These live **only inside** a `Subgraph.parameters.children.graph.nodes`
array (the validator emits `pseudo_node_at_root` for any pseudo-node at
root level).

```ts
{
  id: number,
  type: "SubgraphInput" | "SubgraphOutput",
  position: { x, y },
  parameters: {
    name: string,         // user-visible port name; must be non-empty and unique among siblings of the same kind
    portType: string      // any string; the same `type` strings used in port descriptors (e.g., "int")
  }
}
```

A `SubgraphInput` projects to an **input** port on the enclosing
`Subgraph` node at the parent level (named `parameters.name`, typed
`parameters.portType`). A `SubgraphOutput` projects to an **output**
port. Outer edges reference these projected ports as if they were native
ports on the `Subgraph` node.

Validator codes specific to sub-graphs:
`reserved_node_type`, `subgraph_invalid_parameters`,
`pseudo_node_invalid_parameters`, `pseudo_node_at_root`,
`pseudo_node_duplicate_name`, `subgraph_port_unbound`,
`subgraph_port_type_mismatch`, `subgraph_input_unconnected`,
`subgraph_output_unconnected`, `empty_subgraph`.

### 1.8 Worked example — a simple add graph

```json
{
  "version": 1,
  "graph": {
    "nodes": [
      { "id": 1, "name": "Two",   "type": "Constant", "position": { "x":   0, "y": 0 }, "parameters": { "value": 2 } },
      { "id": 2, "name": "Three", "type": "Constant", "position": { "x": 200, "y": 0 }, "parameters": { "value": 3 } },
      { "id": 3, "name": "Adder", "type": "Add",      "position": { "x": 400, "y": 0 }, "parameters": {} },
      { "id": 4, "name": "Output","type": "Print",    "position": { "x": 600, "y": 0 }, "parameters": {} }
    ],
    "edges": [
      { "id": "e1_out__3_a",   "source": { "node": 1, "port": "out" }, "target": { "node": 3, "port": "a"  } },
      { "id": "e2_out__3_b",   "source": { "node": 2, "port": "out" }, "target": { "node": 3, "port": "b"  } },
      { "id": "e3_sum__4_in",  "source": { "node": 3, "port": "sum" }, "target": { "node": 4, "port": "in" } }
    ],
    "comments": []
  }
}
```

(Identical to `fixtures/versioned/simple-add.json`.)

### 1.9 Worked example — same graph with an `Add` grouped into a sub-graph

```json
{
  "version": 1,
  "graph": {
    "nodes": [
      { "id": 1, "type": "Constant", "position": { "x": 0,   "y": 0 }, "parameters": { "value": 2 } },
      { "id": 2, "type": "Constant", "position": { "x": 0, "y": 200 }, "parameters": { "value": 3 } },
      {
        "id": 5,
        "type": "Subgraph",
        "position": { "x": 280, "y": 100 },
        "parameters": {
          "children": {
            "version": 1,
            "graph": {
              "nodes": [
                {
                  "id": 100, "type": "SubgraphInput",  "position": { "x":   0, "y":   0 },
                  "parameters": { "name": "lhs", "portType": "int" }
                },
                {
                  "id": 101, "type": "SubgraphInput",  "position": { "x":   0, "y": 100 },
                  "parameters": { "name": "rhs", "portType": "int" }
                },
                {
                  "id": 3, "type": "Add", "position": { "x": 200, "y": 50 }, "parameters": {}
                },
                {
                  "id": 102, "type": "SubgraphOutput", "position": { "x": 400, "y": 50 },
                  "parameters": { "name": "result", "portType": "int" }
                }
              ],
              "edges": [
                { "id": "e100_out__3_a",    "source": { "node": 100, "port": "out" }, "target": { "node": 3,   "port": "a"  } },
                { "id": "e101_out__3_b",    "source": { "node": 101, "port": "out" }, "target": { "node": 3,   "port": "b"  } },
                { "id": "e3_sum__102_in",   "source": { "node": 3,   "port": "sum" }, "target": { "node": 102, "port": "in" } }
              ],
              "comments": []
            }
          }
        }
      },
      { "id": 4, "type": "Print", "position": { "x": 540, "y": 100 }, "parameters": {} }
    ],
    "edges": [
      { "id": "e1_out__5_lhs",    "source": { "node": 1, "port": "out" },    "target": { "node": 5, "port": "lhs"    } },
      { "id": "e2_out__5_rhs",    "source": { "node": 2, "port": "out" },    "target": { "node": 5, "port": "rhs"    } },
      { "id": "e5_result__4_in",  "source": { "node": 5, "port": "result" }, "target": { "node": 4, "port": "in"     } }
    ],
    "comments": []
  }
}
```

The outer edges reference `5.lhs`, `5.rhs`, and `5.result` as if they
were native ports on the `Subgraph` node. The compiler flattens this
back to the same four-node legacy shape as §1.8 — see §3.4.

---

## 2 · Legacy graph format (read-only)

A *read-only* compatibility format inherited from the runtime's existing
input. Detection: top-level `nodes` and `edges` arrays **without** a
`version` field.

### 2.1 Schema

```ts
{
  nodes: Array<{
    uid: number,         // becomes Node.id
    name?: string,
    type: string,
    value?: number       // applies only to Constant; required for Constant, ignored otherwise
  }>,
  edges: Array<{
    src: number,         // source node uid
    dst: number,         // target node uid
    port_out: string,
    port_in: string
  }>
}
```

### 2.2 Field mapping (legacy → versioned)

| Legacy | Versioned | Notes |
|---|---|---|
| `nodes[i].uid` | `nodes[i].id` | identity |
| `nodes[i].name` | `nodes[i].name` | identity |
| `nodes[i].type` | `nodes[i].type` | identity |
| `nodes[i].value` (Constant only) | `nodes[i].parameters.value` | promoted into `parameters` |
| `nodes[i].position` (absent) | `nodes[i].position = { x: i * 200, y: 0 }` | synthesised — left-to-right by source order |
| `edges[i].src` / `port_out` | `edges[i].source.{node,port}` | rebuilt |
| `edges[i].dst` / `port_in` | `edges[i].target.{node,port}` | rebuilt |
| `edges[i].id` (absent) | `edges[i].id = e<src>_<port_out>__<dst>_<port_in>` | canonical synthesised id |
| (absent) | `comments: []` | always empty for legacy input |
| (absent) | `version: 1` | promoted |

### 2.3 Constant nodes

A legacy `Constant` node **must** carry a `value: integer`. Loading a
legacy graph with a Constant missing `value` produces a load error
(returned through `serializer/loadLegacy`'s discriminated `LoadResult`)
with the message `Constant node <uid> missing required value`.

### 2.4 Save direction is one-way

The editor never *writes* legacy. Save always emits versioned. To
produce legacy from a versioned graph, run `vizgraph compile` — the
compiled output happens to share legacy's wire shape (see §3).

### 2.5 Worked example

```json
{
  "nodes": [
    { "uid": 1, "name": "Two",    "type": "Constant", "value": 2 },
    { "uid": 2, "name": "Three",  "type": "Constant", "value": 3 },
    { "uid": 3, "name": "Adder",  "type": "Add" },
    { "uid": 4, "name": "Output", "type": "Print" }
  ],
  "edges": [
    { "src": 1, "dst": 3, "port_out": "out", "port_in": "a"  },
    { "src": 2, "dst": 3, "port_out": "out", "port_in": "b"  },
    { "src": 3, "dst": 4, "port_out": "sum", "port_in": "in" }
  ]
}
```

(Identical to `fixtures/legacy/simple-add.json`. See
`fixtures/legacy/parallel-add.json` for an 8-node fan-in example.)

### 2.6 What legacy cannot express

- Sub-graphs (`Subgraph` / `SubgraphInput` / `SubgraphOutput` types)
- Comments
- Viewport
- Per-node `frequency_hz`
- Editor positions (legacy ignores them — synthesised on load)

A graph that uses any of the above must be saved as versioned.

---

## 3 · Compiled / runtime-bound output

The shape produced by `vizgraph compile` and consumed by the external
C++ DAG runtime. Wire-shape-equivalent to legacy §2 with one optional
extension (`frequency_hz`).

### 3.1 Schema

```ts
{
  nodes: Array<{
    uid: number,                  // 1-indexed, allocated DFS-order across nested sub-graphs
    name?: string,
    type: string,                 // never one of "Subgraph"/"SubgraphInput"/"SubgraphOutput" in the output
    value?: number,               // present iff type === "Constant"
    frequency_hz?: number         // present iff the source node had a non-null frequency_hz
  }>,
  edges: Array<{
    src: number,                  // source uid
    dst: number,                  // target uid
    port_out: string,
    port_in: string
  }>
}
```

The compiler **drops**: `position`, `viewport`, `parameters` other than
`Constant.value`, all comments, edge `id` strings (each edge is rebuilt
from endpoints), all sub-graph container and pseudo nodes.

### 3.2 `uid` allocation

`uid`s are 1-indexed and assigned in **DFS order of the source
document**: the root graph is walked first, then each `Subgraph`'s
`children` graph is walked recursively in node-array order. Pseudo
nodes do not receive a `uid` (they are fully elided).

This means a node's `uid` in the compiled output is generally **not**
equal to its `id` in the source document. Don't try to round-trip on
`uid == id`. The CLI's `roundtrip` mode exists for editor-internal
verification only and prints versioned, not compiled.

The compiler's `idMap` (path-key string → `uid`) is editor-internal
state that powers the RunResult overlay; it is not surfaced in the
JSON output.

### 3.3 Edge rebuilding

Edges are emitted at the level whose **source** is a real node. When
the source's outgoing edge points at a `SubgraphOutput`, the compiler
chases the outer edges that consume that pseudo-output and emits one
edge per actually-reached real downstream port (fan-out across
sub-graph boundaries is preserved). Symmetrically for sources behind a
`SubgraphInput`. The chase logic lives in
`src/document/subgraphChase.ts`.

`port_out` / `port_in` use the **real** node's port names, not the
pseudo-port names projected onto the `Subgraph` container.

### 3.4 Worked example — §1.9 compiled

The §1.9 graph (with one nested `Add`) compiles to the same four
nodes / three edges as §1.8 — pseudo and container nodes vanish:

```json
{
  "nodes": [
    { "uid": 1, "type": "Constant", "value": 2 },
    { "uid": 2, "type": "Constant", "value": 3 },
    { "uid": 3, "type": "Add" },
    { "uid": 4, "type": "Print" }
  ],
  "edges": [
    { "src": 1, "dst": 3, "port_out": "out", "port_in": "a"  },
    { "src": 2, "dst": 3, "port_out": "out", "port_in": "b"  },
    { "src": 3, "dst": 4, "port_out": "sum", "port_in": "in" }
  ]
}
```

`uid`s 1 and 2 come from the root `Constant`s (DFS order, root first);
`uid` 3 comes from the `Add` inside the sub-graph; `uid` 4 comes from
the root `Print`. Source-document `id`s 1, 2, 100, 101, 3, 102, 4 are
discarded.

### 3.5 Compile errors

`compile()` throws a JS `Error` if a `Constant` is missing `value`,
holds a non-integer, or if an outer edge references a sub-graph port
that resolves to nothing. These failures are *belt-and-suspenders* —
the editor pipeline calls `validate()` first and refuses export on any
error severity. External callers that bypass validation will surface
these as exceptions.

---

## 4 · `RunResult` (Inspect-mode import)

Read-only. The editor never writes this format. Imported via
**Import RunResult** in the top bar; once loaded, the editor switches
into Inspect mode and overlays per-node values on the canvas.

### 4.1 Schema

```ts
{
  version: 1,                     // literal
  graph_id: string | null,        // identifier of the graph this run-result was produced against; null is allowed
  ticks: RunResultTick[]          // at least one tick
}

RunResultTick: {
  tick: number,                   // non-negative integer, monotonic but ids may be sparse
  started_at_ns: number,          // non-negative
  duration_ns: number,            // non-negative
  nodes: RunResultNode[]
}

RunResultNode: {
  id: number,                     // matches a uid in the compiled graph (NOT a source-document id)
  path?: number[],                // chain of Subgraph node ids from root; defaults to [] (root level)
  outputs?: Record<string, unknown>,   // map: output port name → arbitrary JSON; defaults to {}
  duration_ns: number,            // non-negative
  error: string | null            // null = success
}
```

### 4.2 Binding to the editor canvas

The editor binds RunResultNode entries to canvas nodes through the
`(path, id)` pair, where `id` matches the compiled `uid`. When the
loaded source document has no sub-graphs, `path` is empty / absent and
`id` is the legacy `uid`. The runtime is expected to emit RunResult
entries keyed on the same uids it received in the compiled JSON.

### 4.3 `outputs` typing

`outputs[port]` is rendered by the editor according to the
`NodeTypeDescription.outputs[port].type` of the corresponding node. The
editor reads values as `unknown` and stringifies for display — there
is no client-side type-check. Producers should keep values JSON-native
(numbers, strings, booleans, arrays, objects, null).

### 4.4 Worked example

```json
{
  "version": 1,
  "graph_id": "simple-add",
  "ticks": [
    {
      "tick": 0,
      "started_at_ns": 0,
      "duration_ns": 27000,
      "nodes": [
        { "id": 1, "outputs": { "out": 2 }, "duration_ns": 1000,  "error": null },
        { "id": 2, "outputs": { "out": 3 }, "duration_ns": 1000,  "error": null },
        { "id": 3, "outputs": { "sum": 5 }, "duration_ns": 12000, "error": null },
        { "id": 4, "outputs": {},           "duration_ns": 13000, "error": null }
      ]
    }
  ]
}
```

(Identical to `fixtures/run-results/simple-add.json`.)

Multi-tick is supported by simply listing more `RunResultTick` entries
in `ticks`. The editor renders ◀ / `tick i / N` / ▶ controls when
`ticks.length > 1`.

---

## 5 · `NodeTypeDescription` (registry / plugin contract)

Not a wire format on disk, but the contract for **plugin / external
node-type registration**. Each type registered against the registry is
re-parsed through this Zod schema; schema-invalid input is rejected
before the registry is mutated.

### 5.1 Schema

```ts
{
  type: string,                   // unique within the registry
  display_name: string,           // shown in the palette
  category: string,               // groups palette entries
  inputs:  PortDescription[],     // input port list, render order = array order
  outputs: PortDescription[],     // output port list, render order = array order
  parameters: Record<string, ParameterDescription>
}

PortDescription: {
  name: string,
  type?: string                   // optional. Two ports with both `type` set must match for an edge to validate.
}                                 // Either side absent => validator does not gate on type.

ParameterDescription: {
  type: string,                   // type-checked: "int", "float" | "number", "bool" | "boolean", "string"; any other string is accepted forward-compat (validator emits no parameter_type_mismatch)
  required?: boolean,             // default false
  default?: unknown               // applied by the editor when materialising a fresh node
}
```

### 5.2 Built-in types

```ts
Constant : inputs []                                outputs [{ out: int }]      params { value: { type:"int", required:true, default:0 } }
Add      : inputs [{ a:int }, { b:int }]            outputs [{ sum: int }]      params {}
Print    : inputs [{ in: int }]                     outputs []                  params {}
Subgraph : inputs [] / outputs []                                               params {}                      # outer-face ports derived dynamically
SubgraphInput  : inputs []                          outputs [{ out }]           params { name:string-required, portType:string-required }
SubgraphOutput : inputs [{ in }]                    outputs []                  params { name:string-required, portType:string-required }
```

### 5.3 Registration pattern

```ts
import { defaultRegistry } from "./src/registry/registry";

defaultRegistry().register({
  type: "Counter",
  display_name: "Counter",
  category: "Plugin",
  inputs:  [{ name: "tick", type: "int" }],
  outputs: [{ name: "count", type: "int" }],
  parameters: { start: { type: "int", required: false, default: 0 } },
});
```

Re-registration of an existing `type` throws unless `{ replace: true }`
is passed; `unregister(type)` removes a type. Reactivity for hot-add
**after** `app.mount()` is deferred — registration must complete before
mount.

---

## 6 · `Diagnostic` (validator output)

The shape of every entry produced by the validator and surfaced both in
the in-editor `ValidationPanel` and via `vizgraph validate --json`.

### 6.1 Schema

```ts
{
  severity: "error" | "warning",
  code: string,                  // see §6.2 for the canonical set
  message: string,               // human-readable; messages may change between versions, codes do not
  node_id?: number,              // present when the diagnostic is bound to a node
  edge_id?: string,              // present when the diagnostic is bound to an edge
  field?:  string,               // dotted-path of the offending field (e.g., "parameters.value", "source.port")
  path?:   number[]              // chain of Subgraph ids from root to the level where the offence lives; absent/empty = root
}
```

### 6.2 Canonical codes

Stable strings — treat as the API. Source: `src/validator/codes.ts`.

| Code | Severity | Notes |
|---|---|---|
| `duplicate_node_id` | error | Two nodes with the same `id` in one graph |
| `unknown_node_type` | error | `type` not present in the registry |
| `missing_required_parameter` | error | `parameters[k]` absent for a required key |
| `parameter_type_mismatch` | error | `parameters[k]` value not of declared `type` |
| `invalid_frequency` | error | `frequency_hz <= 0` |
| `frequency_for_missing_node` | error | reserved; not currently emittable (frequency lives on the node) |
| `duplicate_edge_id` | error | Two edges with the same `id` in one graph |
| `missing_source_node` | error | `edge.source.node` not in `graph.nodes` |
| `missing_target_node` | error | `edge.target.node` not in `graph.nodes` |
| `invalid_source_port` | error | `edge.source.port` not in source's `outputs[]` |
| `invalid_target_port` | error | `edge.target.port` not in target's `inputs[]` |
| `port_type_mismatch` | error | endpoints' typed ports disagree |
| `self_loop` | error | edge whose `source.node === target.node` |
| `cycle` | error | strongly-connected component of size > 1 |
| `isolated_node` | warning | node with no incident edges |
| `unconnected_input` | warning | input port with no incoming edge |
| `reserved_node_type` | error | non-built-in trying to claim `Subgraph*` types |
| `subgraph_invalid_parameters` | error | `Subgraph` parameters do not satisfy `SubgraphParametersSchema` |
| `pseudo_node_invalid_parameters` | error | `SubgraphInput`/`SubgraphOutput` parameters do not satisfy `PseudoPortParametersSchema` |
| `pseudo_node_at_root` | error | `SubgraphInput`/`Output` not inside a `Subgraph.children` |
| `pseudo_node_duplicate_name` | error | two pseudo-inputs (or two pseudo-outputs) share a `name` within one sub-graph |
| `subgraph_port_unbound` | error | outer edge references a port that no pseudo-node projects |
| `subgraph_port_type_mismatch` | error | outer edge port type vs pseudo `portType` mismatch |
| `subgraph_input_unconnected` | warning | a `SubgraphInput` is wired internally but not bound externally |
| `subgraph_output_unconnected` | warning | symmetric |
| `empty_subgraph` | warning | a `Subgraph.children` graph has no nodes |

### 6.3 Granularity rule

For uniqueness/dedup rules (`duplicate_node_id`, `duplicate_edge_id`,
`pseudo_node_duplicate_name`), the validator emits **one** diagnostic
per distinct violating value, in first-occurrence order — not one per
occurrence. For per-element rules (everything else), one diagnostic
per offending element.

### 6.4 Worked example

```json
[
  {
    "severity": "error",
    "code": "missing_required_parameter",
    "message": "Node 1 of type Constant is missing required parameter 'value'.",
    "node_id": 1,
    "field": "parameters.value"
  },
  {
    "severity": "warning",
    "code": "isolated_node",
    "message": "Node 7 has no incident edges.",
    "node_id": 7
  }
]
```

---

## 7 · Interop matrix

| Producer → Consumer | Format | Notes |
|---|---|---|
| External tool → vizgraph editor (Open) | versioned (§1) or legacy (§2) | Auto-detected by the presence of top-level `version` |
| External tool → vizgraph CLI (`validate` / `compile` / `roundtrip`) | versioned or legacy | Same auto-detection |
| vizgraph editor → external tool (Save) | versioned only | One-way; legacy is read-only |
| vizgraph CLI (`compile`) → C++ runtime | compiled / runtime-bound (§3) | Wire-shape-equivalent to legacy plus optional `frequency_hz` |
| C++ runtime → vizgraph editor (Import RunResult) | RunResult (§4) | Keyed on **compiled** `uid`, not source-document `id` |
| Plugin code → registry | `NodeTypeDescription` (§5) | At app boot, before `mount` |
| vizgraph validator → caller | `Diagnostic[]` (§6) | Editor panel + CLI `--json` mode |

### 7.1 CLI exit codes

`vizgraph <subcommand> <file.json> [flags]`:

- `0` — success
- `1` — validation or compile errors
- `2` — bad invocation (unknown subcommand, missing file, parse failure)

Subcommands and flags:

- `validate <file>` — load + validate. `--json` prints `Diagnostic[]`
  to stdout. `--warnings-as-errors` promotes warnings into the exit-1
  bucket.
- `compile <file>` — load + validate + compile. Prints compiled JSON
  to stdout, or `--out <path>` writes there. `--pretty` enables
  2-space indentation.
- `roundtrip <file>` — load (legacy or versioned) and emit
  versioned. For editor-internal verification; not for runtime use.

---

## 8 · Versioning policy

- Versioned `GraphDocument` is at `version: 1`. Future incompatible
  shape changes will bump this literal; the loader will reject mismatched
  versions with a clear error rather than guessing.
- Additive changes (e.g., the `Comment.attachedTo` field added
  2026-05-04) do **not** bump the version. They are designed so that
  v1 documents lacking the new field still parse cleanly; older editors
  reading new documents will simply ignore the unknown field if they
  use a tolerant parser, or — under strict-mode Zod parsing — reject
  it. The codebase uses tolerant parsing for forward-compat.
- `Diagnostic.code` strings are stable contract. New codes may be
  added (the runtime schema accepts any string for `code` to permit
  this). Existing codes will not be renamed without a major version.
- `RunResult` is at `version: 1` and follows the same policy.
- The compiled runtime JSON is **unversioned** and tracks the runtime's
  own contract. If the runtime ever changes its expected shape, that
  change is downstream of this project.

---

## 9 · Quick reference for external producers

Minimum versioned graph that loads cleanly into the editor (no
warnings, no errors, no runtime semantics):

```json
{ "version": 1, "graph": { "nodes": [], "edges": [], "comments": [] } }
```

Minimum versioned graph with one Constant that compiles to a runnable
single-node payload:

```json
{
  "version": 1,
  "graph": {
    "nodes": [
      { "id": 1, "type": "Constant",
        "position": { "x": 0, "y": 0 },
        "parameters": { "value": 42 } }
    ],
    "edges": [],
    "comments": []
  }
}
```

Compiled output:

```json
{ "nodes": [ { "uid": 1, "type": "Constant", "value": 42 } ], "edges": [] }
```

The `isolated_node` warning will fire for that node, since it has no
incident edges; this does not block compile.
