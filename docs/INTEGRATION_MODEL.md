# The integration model between vizgraph and runtime                                                                                     
                                                                                                                
vizgraph and the runtime are independent processes that exchange JSON. The editor produces deploy artefacts; the
runtime produces inspection artefacts. Two directions of data flow, plus one shared concept (node-type
identity) that has to agree on both sides.                                                                      
                                                        
## Direction 1 — deploying a graph to the runtime                                                                  

Someone authors a graph either in the vizgraph editor or in an upstream tool that emits the versioned           
GraphDocument shape (FORMATS.md §1). The editor's Save button always writes versioned, never legacy.
                                                                                                                
Before the runtime ever sees the graph, the deploy pipeline runs vizgraph validate against it. If validation    
passes (exit 0), the pipeline runs vizgraph compile, which produces the runtime-bound JSON described in
FORMATS.md §3. That compiled JSON is wire-shape-equivalent to the legacy format the runtime already accepts,    
plus an optional per-node frequency_hz.                   

What happens during compile is the substantive translation: the editor's hierarchical sub-graphs are flattened  
recursively, pseudo-nodes (SubgraphInput/SubgraphOutput) are elided, edges are chased across sub-graph
boundaries (so a single source can fan out to multiple downstream targets when the chain crosses pseudo-port    
indirection), and every real node gets a fresh integer uid allocated in DFS order. Editor-only fields
(positions, viewport, comments, edge ids, the document version itself) are dropped. What remains is exactly what
the C++ runtime's GraphMT::add_node / add_edge / set_node_frequency calls need.

The runtime ingests compiled.json, walks the nodes array calling add_node(uid, type, …) for each entry (passing 
value for Constants and frequency_hz where present), then walks edges calling add_edge(src, dst, port_out, 
port_in). After that, the DAG is ready to execute.                                                              
                                                        
## Direction 2 — inspecting a run

Once the runtime executes a graph (single-shot or per-tick), it captures per-node output values, durations, and 
any errors, and writes them to a RunResult JSON file (FORMATS.md §4). To inspect that run, the user opens the
original source GraphDocument in the editor (the same versioned file that was compiled, not the flattened one), 
then clicks Import RunResult. The editor switches to Inspect mode and overlays each node with its outputs and
timing.

The crucial keying rule: RunResult.nodes[i].id is the compiled uid, not the source document's id. The runtime   
received uids in the compiled JSON, so emitting them back in the RunResult is natural — but it does mean the
runtime cannot re-use source-document ids it has never seen.                                                    
                                                        
For multi-tick runs, just append more RunResultTick entries to ticks; the editor's ◀ tick i / N ▶ control pages 
through them.
                                                                                                                
## The shared concept — node-type identity                                                                         

The type string is the contract between editor and runtime. Constant in the compiled JSON has to mean exactly   
what Constant means in the runtime, with the same input ports, the same output ports, and the same parameter
expectations.                                                                                                   
                                                        
This has practical consequences:

- Port names must match between the runtime's internal handles and the editor's NodeTypeDescription. If the     
runtime registers an Add with input ports lhs/rhs but the editor's NodeTypeDescription advertises a/b, the
deployed graph will reference a/b in its edges — and the runtime's edge-add will fail because it doesn't know   
those handles. The runtime is the source of truth for port naming; the editor's NodeTypeDescriptions should
mirror it.
- Plugin types must exist on both sides. If you register a third-party Counter node-type in the editor's plugin
registry but the runtime doesn't know how to construct one, the runtime will reject the graph at load time. Pair
editor-side plugin registration with a corresponding runtime-side registration.
                                                                                                                
Validation as a deployment gate                           

vizgraph validate --json is meant to be wired into CI. The diagnostic codes (FORMATS.md §6) are stable contract 
— you can build a watchlist that distinguishes deployment-blocking issues from informational ones.
                                                                                                                
Codes that should always fail a deploy: unknown_node_type, missing_required_parameter, parameter_type_mismatch, 
cycle, self_loop, all subgraph_* errors, invalid_source_port, invalid_target_port, port_type_mismatch. Codes
that are usually safe to allow through (work-in-progress drafts): isolated_node, unconnected_input, the two     
subgraph_*_unconnected warnings, empty_subgraph. The --warnings-as-errors flag flips that distinction off if you
want maximum strictness.

## Sub-graphs + RunResult: a known integration gap

The compiler flattens sub-graphs entirely. The runtime never sees Subgraph* types and operates on a flat DAG.   
That works perfectly for the deploy direction.
                                                                                                                
The inspect direction is where it gets thinner. The RunResult.path field exists so the editor can route per-node
values to the right depth in the source-document hierarchy (so when you drill into a sub-graph in Inspect mode,
the inner nodes' overlays appear). But the editor's compile step builds an internal uid → (path, source-id) map
that is not surfaced in the compiled JSON today. The runtime therefore has no way to know which sub-graph a
given uid originated in.

Three workarounds, in order of effort:                                                                          

1. Keep runtime-bound graphs flat. If sub-graphs are an authoring convenience but you flatten before deploy     
anyway, this is moot — emit path: [] (or omit it) and id == uid and everything works.
2. Add an id == uid fallback in the editor. Cheapest editor-side change: when RunResult.path is empty for a node
whose uid corresponds to an inside-sub-graph location, display the overlay at root level. Loses the drill-in   
fidelity but covers the common case.
3. Extend the CLI to emit a sidecar id-map (uid → (path, source-id)) alongside the compiled JSON, have the      
runtime echo path back in RunResults. Cleanest end-to-end design but requires changes on both sides.            

If sub-graph inspection is a real goal for your runtime, this is worth tracking as an open issue. If sub-graphs 
are author-time only, it isn't.                           
                                                                                                                
## The operational loop, end to end                          

A designer authors a graph in vizgraph and saves the versioned JSON. CI runs vizgraph validate                  
--warnings-as-errors and fails the build on any diagnostic; on green, it runs vizgraph compile … --out 
runtime.json. The runtime container loads runtime.json at startup, constructs the DAG, and executes. On         
completion (or per-tick), it emits a RunResult JSON to a known location. The designer fetches the RunResult,
opens the original versioned source in the editor, clicks Import RunResult, and inspects.

The contract surface across that loop is small and entirely captured by FORMATS.md: the versioned GraphDocument 
for input, the compiled JSON shape for runtime ingestion, and the RunResult shape for inspection. Anything
outside those three shapes is implementation detail on one side or the other.  