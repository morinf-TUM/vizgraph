import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { Viewport } from "../../document/types";

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

export const useEditorStore = defineStore("editor", () => {
  const selectedNodeIds = ref<Set<number>>(new Set());
  const selectedEdgeIds = ref<Set<string>>(new Set());
  const viewport = ref<Viewport>({ ...DEFAULT_VIEWPORT });
  const dirty = ref(false);

  const hasSelection = computed(
    () => selectedNodeIds.value.size > 0 || selectedEdgeIds.value.size > 0,
  );

  const selectNode = (id: number, additive = false): void => {
    if (!additive) {
      selectedNodeIds.value = new Set([id]);
      selectedEdgeIds.value = new Set();
      return;
    }
    const next = new Set(selectedNodeIds.value);
    next.add(id);
    selectedNodeIds.value = next;
  };

  const selectEdge = (id: string, additive = false): void => {
    if (!additive) {
      selectedEdgeIds.value = new Set([id]);
      selectedNodeIds.value = new Set();
      return;
    }
    const next = new Set(selectedEdgeIds.value);
    next.add(id);
    selectedEdgeIds.value = next;
  };

  const toggleNodeSelection = (id: number): void => {
    const next = new Set(selectedNodeIds.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedNodeIds.value = next;
  };

  const clearSelection = (): void => {
    selectedNodeIds.value = new Set();
    selectedEdgeIds.value = new Set();
  };

  const setViewport = (next: Viewport): void => {
    viewport.value = next;
  };

  const markDirty = (): void => {
    dirty.value = true;
  };

  const markClean = (): void => {
    dirty.value = false;
  };

  return {
    selectedNodeIds,
    selectedEdgeIds,
    viewport,
    dirty,
    hasSelection,
    selectNode,
    selectEdge,
    toggleNodeSelection,
    clearSelection,
    setViewport,
    markDirty,
    markClean,
  };
});
