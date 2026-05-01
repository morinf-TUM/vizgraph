# Prompt: Adapt n8n-Style Graph Editing for a Real-Time DAG Runtime

You are an AI engineering agent. Your task is to design, plan, and implement a graphical graph-building and graph-display experience for a small C++ real-time computational DAG runtime. You should be able to do the work from this prompt alone, without access to the original repository that inspired it.

The runtime executes acyclic graphs of typed compute nodes. It already has a minimal JSON runner and a minimal native node viewer, but the viewer is mostly read-only and incorrectly renders one generic input and one generic output per node. The central goal is to build a usable editor whose document model, node metadata, port mapping, validation, and serialization match the runtime contracts described below.

Use the n8n repository and official n8n documentation as reference material for mature workflow-canvas behavior. Do not copy n8n code unless you have verified that the current license terms are acceptable for the project you are working in.

## Mission

Create a browser-based or otherwise modern graphical editor for computational DAGs, informed by n8n's workflow editor concepts:

- canvas with draggable nodes
- typed and named node ports
- drag-to-connect edges
- node palette/search
- node property panel
- JSON import/export
- validation feedback
- optional execution/telemetry display
- undo/redo and copy/paste as later milestones

The goal is not to clone n8n. The goal is to adapt the useful graph-building and display patterns from n8n to a soft-real-time computational graph domain.

## License Constraint

n8n is source-available/fair-code and has historically used the Sustainable Use License and n8n Enterprise License. Before copying any n8n code, verify the current license terms and confirm they are acceptable for this project. Prefer using n8n as an architectural and UX reference, then implement project-specific code with compatible dependencies. If direct reuse is desired, stop and document the license risk before proceeding.

## Runtime Contract

The target runtime is a C++ DAG execution engine with these core concepts:

```cpp
struct NodeMT {
    using Ports = std::unordered_map<std::string, std::any>;
    virtual ~NodeMT() = default;

    // All existing compute nodes implement this method.
    virtual void compute(const Ports& in, Ports& out) = 0;

    // Optional timing-aware extension.
    virtual bool wants_timing_context() const { return false; }

    virtual void compute_with_timing(
        const Ports& in,
        Ports& out,
        const CycleTimingInfo& timing
    ) {
        compute(in, out);
    }
};

struct EdgeMT {
    int srcNode;
    int dstNode;
    std::string srcPort;
    std::string dstPort;
};

struct NodeFrequencyConfig {
    std::optional<double> frequency_hz;
    size_t frequency_divisor = 1;

    bool is_valid() const {
        return !frequency_hz.has_value() || frequency_hz.value() > 0.0;
    }
};

class GraphMT {
public:
    std::unordered_map<int, std::shared_ptr<NodeMT>> nodes;
    std::unordered_map<int, NodeMT::Ports> outputs;
    std::vector<EdgeMT> edges;
    std::unordered_map<int, NodeFrequencyConfig> node_frequencies;

    bool initialize();
    bool reset();
    void shutdown();

    void tick_mt(size_t thread_count = 4);
    void tick_sequential();
    bool validate() const;

    void archive_outputs();
    void clear_outputs();

    void set_node_frequency(int node_id, double frequency_hz);
    void clear_node_frequency(int node_id);
    std::optional<double> get_node_frequency(int node_id) const;
};
```

Runtime execution rules:

- `GraphMT.nodes` maps integer node IDs to compute-node instances.
- `GraphMT.edges` contains directed connections from a source node's named output port to a destination node's named input port.
- `GraphMT.outputs` stores each node's most recent output ports after execution.
- `tick_mt()` and `tick_sequential()` execute nodes in topological order.
- A node is ready when all incoming edges have produced source output values.
- The graph topology must be a DAG. Cycles are invalid.
- "Cyclical execution" means repeatedly executing an acyclic graph at a fixed rate. It does not mean cyclic graph structure is supported.
- `initialize()` validates the graph before execution.
- `validate()` currently checks at least: missing edge source nodes, missing edge destination nodes, self-loops, cycles, isolated-node warnings, invalid node-frequency config, and frequency config for missing nodes.
- Runtime exceptions from `compute()` should be surfaced with the node ID and available input port names.
- Editor layout metadata must stay outside `GraphMT` unless the runtime truly needs it.

## Built-In Node Types

The initial editor must support these built-in node types.

### Constant

Runtime behavior:

```cpp
struct ConstantNodeMT : NodeMT {
    int value;
    ConstantNodeMT(int v) : value(v) {}
    void compute(const Ports&, Ports& out) override { out["out"] = value; }
};
```

Node type metadata:

```json
{
  "type": "Constant",
  "display_name": "Constant",
  "category": "Input",
  "inputs": [],
  "outputs": [{"name": "out", "type": "int"}],
  "parameters": {
    "value": {"type": "int", "required": true, "default": 0}
  }
}
```

### Add

Runtime behavior:

```cpp
struct AddNodeMT : NodeMT {
    void compute(const Ports& in, Ports& out) override {
        int a = std::any_cast<int>(in.at("a"));
        int b = std::any_cast<int>(in.at("b"));
        out["sum"] = a + b;
    }
};
```

Node type metadata:

```json
{
  "type": "Add",
  "display_name": "Add",
  "category": "Math",
  "inputs": [
    {"name": "a", "type": "int"},
    {"name": "b", "type": "int"}
  ],
  "outputs": [{"name": "sum", "type": "int"}],
  "parameters": {}
}
```

### Print

Runtime behavior:

```cpp
struct PrintNodeMT : NodeMT {
    void compute(const Ports& in, Ports&) override {
        std::cout << std::any_cast<int>(in.at("in")) << std::endl;
    }
};
```

Node type metadata:

```json
{
  "type": "Print",
  "display_name": "Print",
  "category": "Output",
  "inputs": [{"name": "in", "type": "int"}],
  "outputs": [],
  "parameters": {}
}
```

## Legacy JSON Format

Existing graph files use this legacy JSON format and must remain loadable:

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

Legacy node fields:

- `uid`: required integer node ID.
- `name`: optional user-facing node name.
- `type`: required node type string.
- `value`: required integer only for `Constant` nodes.

Legacy edge fields:

- `src`: required integer source node ID.
- `dst`: required integer destination node ID.
- `port_out`: required source output port name.
- `port_in`: required destination input port name.

Legacy loader behavior:

- Construct `Constant` from `value`.
- Construct `Add` and `Print` without parameters.
- Preserve `name` when present.
- If no layout position exists, assign a deterministic default position.
- Validate port names using explicit node-type metadata, not by assuming one input and one output.

## Current Sample Graphs

The following examples are compatibility fixtures. They should load, validate, compile to `GraphMT`, and execute.

### Simple Add Graph

Expected runtime output: `5`

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

### Parallel Add Graph

Expected runtime output: `100`

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

## New Graph Document Format

Implement or formalize a versioned editor/runtime document model. Recommended JSON:

```json
{
  "version": 1,
  "graph": {
    "nodes": [
      {
        "id": 1,
        "name": "Two",
        "type": "Constant",
        "position": {"x": 100, "y": 100},
        "parameters": {"value": 2},
        "frequency_hz": null
      },
      {
        "id": 3,
        "name": "Adder",
        "type": "Add",
        "position": {"x": 360, "y": 160},
        "parameters": {},
        "frequency_hz": null
      }
    ],
    "edges": [
      {
        "id": "e1",
        "source": {"node": 1, "port": "out"},
        "target": {"node": 3, "port": "a"}
      }
    ],
    "viewport": {"x": 0, "y": 0, "zoom": 1.0}
  }
}
```

Required semantics:

- `version` is required for the new format.
- `graph.nodes[].id` is the runtime node ID.
- `graph.nodes[].name` is user-facing and should not be required to be unique.
- `graph.nodes[].type` selects a `NodeTypeDescription`.
- `graph.nodes[].position` is editor-only layout metadata.
- `graph.nodes[].parameters` contains node constructor/configuration values.
- `graph.nodes[].frequency_hz` is optional or null; if present, it must be positive and maps to `GraphMT::set_node_frequency(id, value)`.
- `graph.edges[].id` is an editor-stable edge ID. If absent during migration, generate a deterministic ID such as `e<src>_<srcPort>__<dst>_<dstPort>`.
- `graph.edges[].source.node` and `target.node` refer to node IDs.
- `graph.edges[].source.port` and `target.port` refer to named ports declared by the source/target node type metadata.
- `graph.viewport` is editor-only and must not affect runtime execution.

Backward compatibility:

- The loader must detect legacy JSON by the presence of top-level `nodes` and `edges` without top-level `version`.
- The loader must detect the new format by top-level `version` plus `graph`.
- Saving may default to the new format, but legacy examples must remain loadable.
- If the existing CLI runner only reads legacy JSON, add either a migration path, a compatibility export, or update the runner with tests.

## Required Internal Boundaries

Introduce these boundaries. Names can vary by language/framework, but the responsibilities should remain explicit.

### GraphDocument

Serializable editor/runtime graph definition:

- nodes
- edges
- layout positions
- viewport
- node parameters
- per-node frequency config

It must not contain live runtime pointers, UI widget state, or transient execution outputs.

### NodeTypeRegistry

Metadata and factory source for node types:

- type name
- display name
- category
- input port descriptions
- output port descriptions
- parameter schema
- factory function for runtime construction

The editor must use this registry to render ports, property forms, palette entries, and validation messages.

### NodeTypeDescription

Recommended shape:

```json
{
  "type": "Constant",
  "display_name": "Constant",
  "category": "Input",
  "inputs": [],
  "outputs": [{"name": "out", "type": "int"}],
  "parameters": {
    "value": {"type": "int", "required": true, "default": 0}
  }
}
```

### GraphSerializer

Responsibilities:

- load legacy JSON into `GraphDocument`
- load versioned JSON into `GraphDocument`
- save `GraphDocument` to the versioned JSON format
- optionally export to the legacy format
- preserve node IDs, names, parameters, edge endpoints, positions, frequencies, and viewport where supported

### GraphCompiler

Converts `GraphDocument` into a runtime `GraphMT`:

- instantiate the correct runtime node class for each document node
- pass `Constant.parameters.value` to `ConstantNodeMT`
- create `EdgeMT` values from document edges
- apply `frequency_hz` using `set_node_frequency`
- call validator before execution

### GraphValidator

Return structured diagnostics rather than only printing strings.

Recommended diagnostic shape:

```json
{
  "severity": "error",
  "code": "invalid_target_port",
  "message": "Node 3 of type Add has no input port named c.",
  "node_id": 3,
  "edge_id": "e2",
  "field": "target.port"
}
```

Required checks:

- duplicate node IDs
- missing node IDs
- unknown node types
- missing required parameters
- invalid parameter types
- invalid or non-positive frequency
- frequency set for a missing node
- duplicate edge IDs
- missing source node
- missing target node
- invalid source output port
- invalid target input port
- source/target type mismatch where port types are known
- self-loop
- graph cycle
- optional warning for isolated nodes
- optional warning for unconnected required input ports

### EditorState

Transient UI state:

- selected nodes and edges
- viewport during editing
- dirty flag
- undo/redo history
- clipboard
- validation panel state
- execution status display

Do not persist transient selection, dirty flag, undo stack, clipboard, or runtime output into `GraphDocument`.

## Existing Editor Problem to Fix

The current minimal native editor has this incorrect behavior:

- It loads graph JSON and constructs a runtime graph.
- It renders every node with one input pin named `in` and one output pin named `out`.
- It maps edge links using synthetic pin IDs such as `pin_base + node_id * 2`.
- This loses actual port names. For example, `Add` must have input ports `a` and `b`, and output port `sum`; `Print` must have input `in` and no output; `Constant` must have output `out` and no input.

Any replacement or improvement must render ports from `NodeTypeRegistry`. Do not hardcode one input and one output per node.

## n8n Research Targets

Use the current `n8n-io/n8n` repository and official n8n docs as reference material. Inspect the current file layout rather than relying on stale paths; n8n has moved parts of the editor over time.

Start with these concepts and likely source areas:

- frontend editor UI package
- canvas/workflow components, commonly under `components/canvas` or `features/canvas`
- workflow view components such as `NodeView.vue` or `WorkflowCanvas.vue` if present
- canvas operations/composables such as `useCanvasOperations.ts`
- node creator/palette store and components
- workflow store/model types
- history/undo command model
- import/export workflow JSON handling
- connection creation/deletion code
- node parameter/property panel code

From n8n, extract patterns, not product-specific assumptions:

- separation of canvas state from persisted workflow state
- stable machine IDs versus user-facing names
- node type metadata driving palette entries, ports, and property forms
- connection handles mapping to typed/named inputs/outputs
- layout and viewport persistence
- dirty state and undo/redo tracking
- import/export preserving graph structure
- validation and user feedback without blocking editing

## UI Direction

Prefer a web editor if the project can tolerate a frontend dependency, because n8n's strongest transferable value is its browser canvas/editor architecture.

Practical stack options:

- TypeScript + Vue + Vue Flow, matching n8n's recent frontend direction where appropriate
- TypeScript + React + React Flow, if that is simpler for the target codebase
- Native C++ + ImGui/ImNodes, if avoiding web dependencies is a hard requirement

If staying native C++, still use the same document/registry/serializer/compiler boundaries. The UI technology must not determine the persisted graph schema.

Required first usable editor:

- open an existing legacy graph JSON
- display nodes with real named ports
- drag nodes and persist positions
- add `Constant`, `Add`, and `Print` nodes from a palette
- edit `Constant.value`
- connect ports by dragging
- delete nodes and edges
- validate before save and before execution
- save versioned JSON
- compile to the runtime graph and run the simple examples successfully

## Implementation Phases

### Phase 0: Analysis and Decision

Deliver:

- a short written architecture note
- decision: web editor or native editor
- exact dependency plan
- exact files/modules to add or modify in your working project
- license note for n8n reuse

Do not implement large code before this note exists.

### Phase 1: Schema and Runtime Adapter

Deliver:

- `GraphDocument` model
- node registry for built-in nodes
- serializer that reads legacy graph JSON and writes the new format
- compiler from document to `GraphMT`
- validator with structured diagnostics
- tests covering the sample graphs in this prompt

Acceptance:

- legacy sample graphs still load and execute
- invalid port, type, edge, parameter, and cycle cases produce useful diagnostics

### Phase 2: Minimal Visual Editor

Deliver:

- canvas rendering with real named ports
- node movement and persisted positions
- node palette for built-ins
- property panel for `Constant`
- create/delete edges and nodes
- save/load JSON

Acceptance:

- a user can recreate the simple add graph graphically, save it, reload it, validate it, compile it, and run it.

### Phase 3: n8n-Inspired UX

Deliver:

- node search/palette
- dirty state
- undo/redo
- copy/paste
- keyboard shortcuts
- validation panel
- fit view/zoom controls
- optional auto-layout/tidy

Acceptance:

- editor handles at least dozens of nodes without visual or state corruption
- operations are undoable where expected

### Phase 4: Execution and Observability

Deliver:

- run graph from editor
- show per-node execution result or last output
- show validation and runtime errors on affected nodes
- optionally display timing/telemetry exported by the runtime

Acceptance:

- execution feedback does not pollute the persisted graph definition
- runtime remains usable without launching the editor

## Constraints

- Preserve existing runtime behavior unless deliberately migrated with tests.
- Keep graph topology acyclic.
- Do not confuse cyclical execution with cyclic graph support.
- Do not hardcode one input and one output per node.
- Do not make the UI schema depend on C++ RTTI alone; use explicit metadata.
- Keep old sample JSON loadable.
- Keep editor metadata separate from compute semantics.
- Avoid broad unrelated refactors.
- Prefer structured parsers and serializers over ad hoc string manipulation.
- Keep node and edge IDs stable across save/load.

## Suggested Validation Tests

Add tests for:

- load legacy JSON into `GraphDocument`
- save/load round trip with positions and parameters
- compile document to `GraphMT`
- execute simple add graph and observe output `5`
- execute parallel add graph and observe output `100`
- reject duplicate node ID
- reject unknown node type
- reject missing required `Constant.value`
- reject wrong parameter type for `Constant.value`
- reject edge with missing source node
- reject edge with missing target node
- reject edge with invalid source port
- reject edge with invalid target port
- reject type mismatch when port types are known
- reject graph cycle
- reject self-loop
- reject non-positive frequency
- warn for isolated node

## Final Deliverables

At completion, provide:

- changed file list
- architecture note
- schema documentation
- build/run instructions
- test commands and results
- explicit remaining limitations
- n8n source areas consulted and what was adapted conceptually
- explicit statement that no n8n code was copied, or a documented license review if any code was copied

Remember: n8n is the reference for mature graph editing UX and architecture. The C++ runtime contract in this prompt is the source of truth for graph semantics.
