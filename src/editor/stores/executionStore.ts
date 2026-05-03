import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { RunResult, RunResultNode, RunResultTick } from "../../document/runresult";
import { useEditorStore } from "./editorStore";

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

  const overlayByPathKey = computed<Map<string, RunResultNode>>(() => {
    const map = new Map<string, RunResultNode>();
    const tick = currentTick.value;
    if (!tick) return map;
    for (const n of tick.nodes) {
      const path = n.path ?? [];
      const key = path.length === 0 ? String(n.id) : `${path.join("/")}/${String(n.id)}`;
      map.set(key, n);
    }
    return map;
  });

  // Scoped to editorStore.currentPath: CustomNode reads this for O(1) overlay
  // lookup of the locally-visible node ids on the current sub-graph level.
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
    overlayByPathKey,
    overlayByLocalNodeId,
    setResult,
    clearResult,
    setTickIndex,
    setMode,
    toggleMode,
  };
});
