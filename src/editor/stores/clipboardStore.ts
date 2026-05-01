import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { GraphEdge, GraphNode } from "../../document/types";
import { useDocumentStore } from "./documentStore";
import { useEditorStore } from "./editorStore";
import { useHistoryStore } from "./historyStore";

const PASTE_OFFSET = 30;

interface Clip {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const cloneClip = (clip: Clip): Clip => JSON.parse(JSON.stringify(clip)) as Clip;

export const useClipboardStore = defineStore("clipboard", () => {
  const docStore = useDocumentStore();
  const editorStore = useEditorStore();
  const history = useHistoryStore();

  const clip = ref<Clip | undefined>(undefined);
  const hasClip = computed(() => clip.value !== undefined);

  const copy = (): boolean => {
    const selectedIds = new Set(editorStore.selectedNodeIds);
    if (selectedIds.size === 0) return false;
    const nodes = docStore.nodes.filter((n) => selectedIds.has(n.id));
    // Capture only edges whose both endpoints are in the selection so the
    // clipboard is internally consistent. Edges connecting selected to
    // unselected nodes are dropped from the clip.
    const edges = docStore.edges.filter(
      (e) => selectedIds.has(e.source.node) && selectedIds.has(e.target.node),
    );
    clip.value = JSON.parse(JSON.stringify({ nodes, edges })) as Clip;
    return true;
  };

  const cut = (): boolean => {
    if (!copy()) return false;
    history.transact("Cut", () => {
      for (const id of editorStore.selectedNodeIds) docStore.removeNode(id);
      editorStore.clearSelection();
      editorStore.markDirty();
    });
    return true;
  };

  const paste = (): { nodeIds: number[]; edgeIds: string[] } | undefined => {
    if (!clip.value) return undefined;
    const fresh = cloneClip(clip.value);

    return history.transact("Paste", () => {
      const idMap = new Map<number, number>();
      const newNodeIds: number[] = [];
      const newEdgeIds: string[] = [];

      for (const node of fresh.nodes) {
        const created = docStore.addNode({
          type: node.type,
          position: { x: node.position.x + PASTE_OFFSET, y: node.position.y + PASTE_OFFSET },
          parameters: node.parameters,
          ...(node.name !== undefined ? { name: node.name } : {}),
          ...(node.frequency_hz !== undefined ? { frequency_hz: node.frequency_hz } : {}),
        });
        idMap.set(node.id, created.id);
        newNodeIds.push(created.id);
      }

      for (const edge of fresh.edges) {
        const newSource = idMap.get(edge.source.node);
        const newTarget = idMap.get(edge.target.node);
        if (newSource === undefined || newTarget === undefined) continue;
        const created = docStore.addEdge({
          source: { node: newSource, port: edge.source.port },
          target: { node: newTarget, port: edge.target.port },
        });
        newEdgeIds.push(created.id);
      }

      editorStore.markDirty();
      editorStore.clearSelection();
      for (const id of newNodeIds) editorStore.selectNode(id, true);

      return { nodeIds: newNodeIds, edgeIds: newEdgeIds };
    });
  };

  return { clip, hasClip, copy, cut, paste };
});
