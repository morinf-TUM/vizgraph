import type { Graph, GraphNode, Position } from "../../document/types";
import {
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
} from "../../document/subgraph";
import { edgeIdFor } from "../../document/ids";
import type { useDocumentStore } from "../stores/documentStore";
import type { useEditorStore } from "../stores/editorStore";
import type { useHistoryStore } from "../stores/historyStore";

type DocStore = ReturnType<typeof useDocumentStore>;
type EditorStore = ReturnType<typeof useEditorStore>;
type HistoryStore = ReturnType<typeof useHistoryStore>;

// Materialize a Subgraph node from the current selection at the present level.
// External edges crossing the selection boundary are preserved by routing
// through auto-generated SubgraphInput / SubgraphOutput pseudo-nodes inside
// the new sub-graph; one pseudo-input per distinct external feeder
// (node, port) and one pseudo-output per distinct internal source (node, port).
export const groupSelection = (
  docStore: DocStore,
  editorStore: EditorStore,
  history: HistoryStore,
): GraphNode | undefined => {
  const selected = [...editorStore.selectedNodeIds];
  if (selected.length === 0) return undefined;
  const level = docStore.currentLevelGraph;
  const selSet = new Set(selected);
  const innerNodes = level.nodes.filter((n) => selSet.has(n.id));
  if (innerNodes.length === 0) return undefined;

  const centroid: Position = innerNodes.reduce(
    (acc, n) => ({ x: acc.x + n.position.x, y: acc.y + n.position.y }),
    { x: 0, y: 0 },
  );
  centroid.x /= innerNodes.length;
  centroid.y /= innerNodes.length;

  return history.transact(`Group ${String(innerNodes.length)} nodes`, () => {
    const crossingsIn = level.edges.filter(
      (e) => !selSet.has(e.source.node) && selSet.has(e.target.node),
    );
    const crossingsOut = level.edges.filter(
      (e) => selSet.has(e.source.node) && !selSet.has(e.target.node),
    );
    const internal = level.edges.filter(
      (e) => selSet.has(e.source.node) && selSet.has(e.target.node),
    );

    // Inner nodes keep their original ids (each level has its own id space).
    // Pseudo-node ids are allocated above the inner max to guarantee no
    // collision with retained inner ids.
    const childGraph: Graph = {
      nodes: innerNodes.map((n) => ({ ...n })),
      edges: internal.map((e) => ({ ...e })),
      comments: [],
    };
    let nextChildId = innerNodes.reduce((m, n) => (n.id > m ? n.id : m), 0) + 1;

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

    // Order matters: snapshot first (above), remove selection (cascades
    // incident edges), then add the new Subgraph + rerouted edges.
    for (const id of selected) docStore.removeNode(id);

    const subgraphNode = docStore.addNode({
      type: SUBGRAPH_NODE_TYPE,
      position: centroid,
      parameters: {
        children: { version: 1, graph: childGraph },
      },
    });
    const subgraphId = subgraphNode.id;

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
