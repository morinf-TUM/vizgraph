import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { RunResult, RunResultNode, RunResultTick } from "../../document/runresult";

export type EditorMode = "edit" | "inspect";

export const useExecutionStore = defineStore("execution", () => {
  const result = ref<RunResult | undefined>(undefined);
  const tickIndex = ref(0);
  const mode = ref<EditorMode>("edit");

  const ticks = computed<RunResultTick[]>(() => result.value?.ticks ?? []);
  const tickCount = computed(() => ticks.value.length);

  const currentTick = computed<RunResultTick | undefined>(() => {
    if (!result.value) return undefined;
    return ticks.value[tickIndex.value];
  });

  // Map of node-id to RunResultNode for the current tick. The CustomNode
  // overlay keys off this so reading is O(1) per node render.
  const overlayByNodeId = computed<Map<number, RunResultNode>>(() => {
    const map = new Map<number, RunResultNode>();
    const tick = currentTick.value;
    if (!tick) return map;
    for (const node of tick.nodes) map.set(node.id, node);
    return map;
  });

  const setResult = (next: RunResult): void => {
    result.value = next;
    tickIndex.value = 0;
    mode.value = "inspect";
  };

  const clearResult = (): void => {
    result.value = undefined;
    tickIndex.value = 0;
    mode.value = "edit";
  };

  const setTickIndex = (idx: number): void => {
    if (!result.value) return;
    const max = result.value.ticks.length - 1;
    if (idx < 0 || idx > max) return;
    tickIndex.value = idx;
  };

  const setMode = (next: EditorMode): void => {
    mode.value = next;
  };

  const toggleMode = (): void => {
    mode.value = mode.value === "edit" ? "inspect" : "edit";
  };

  return {
    result,
    tickIndex,
    mode,
    ticks,
    tickCount,
    currentTick,
    overlayByNodeId,
    setResult,
    clearResult,
    setTickIndex,
    setMode,
    toggleMode,
  };
});
