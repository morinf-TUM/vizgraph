<script setup lang="ts">
import { computed } from "vue";
import { Handle, Position as HandlePosition } from "@vue-flow/core";
import type { GraphNode } from "../../document/types";
import { defaultRegistry } from "../../registry/registry";
import { useExecutionStore } from "../stores/executionStore";

interface Props {
  data: { node: GraphNode };
}
const props = defineProps<Props>();

const registry = defaultRegistry();
const executionStore = useExecutionStore();

const desc = computed(() => registry.get(props.data.node.type));
const inputs = computed(() => desc.value?.inputs ?? []);
const outputs = computed(() => desc.value?.outputs ?? []);
const label = computed(() => props.data.node.name ?? props.data.node.type);

const overlay = computed(() => {
  if (executionStore.mode !== "inspect") return undefined;
  return executionStore.overlayByNodeId.get(props.data.node.id);
});

const formatValue = (v: unknown): string => {
  if (v === null) return "null";
  if (v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v) ?? typeof v;
  } catch {
    return typeof v;
  }
};

const formatDuration = (ns: number): string => {
  if (ns < 1_000) return `${ns} ns`;
  if (ns < 1_000_000) return `${(ns / 1_000).toFixed(1)} µs`;
  if (ns < 1_000_000_000) return `${(ns / 1_000_000).toFixed(1)} ms`;
  return `${(ns / 1_000_000_000).toFixed(2)} s`;
};
</script>

<template>
  <div
    class="custom-node"
    :class="{
      'custom-node--unknown': !desc,
      'custom-node--inspect': overlay,
      'custom-node--errored': overlay?.error,
    }"
  >
    <div class="custom-node__header">
      <span class="custom-node__label">{{ label }}</span>
      <span class="custom-node__type">{{ data.node.type }}</span>
    </div>
    <div class="custom-node__ports">
      <div class="custom-node__inputs">
        <div v-for="port in inputs" :key="`in-${port.name}`" class="custom-node__port">
          <Handle
            :id="port.name"
            type="target"
            :position="HandlePosition.Left"
            class="custom-node__handle"
          />
          <span class="custom-node__port-label">{{ port.name }}</span>
        </div>
      </div>
      <div class="custom-node__outputs">
        <div
          v-for="port in outputs"
          :key="`out-${port.name}`"
          class="custom-node__port custom-node__port--out"
        >
          <span class="custom-node__port-label">
            {{ port.name }}
            <span
              v-if="overlay && overlay.outputs[port.name] !== undefined"
              class="custom-node__overlay-value"
              :data-testid="`overlay-${data.node.id}-${port.name}`"
              >{{ formatValue(overlay.outputs[port.name]) }}</span
            >
          </span>
          <Handle
            :id="port.name"
            type="source"
            :position="HandlePosition.Right"
            class="custom-node__handle"
          />
        </div>
      </div>
    </div>
    <div v-if="overlay" class="custom-node__footer">
      <span v-if="overlay.error" class="custom-node__error">{{ overlay.error }}</span>
      <span v-else class="custom-node__duration">{{ formatDuration(overlay.duration_ns) }}</span>
    </div>
  </div>
</template>

<style scoped>
.custom-node {
  min-width: 140px;
  background: var(--vg-surface);
  border: 1px solid var(--vg-border);
  border-radius: 6px;
  font-size: 12px;
  box-shadow: var(--vg-shadow-sm);
}
.custom-node--unknown {
  border-color: var(--vg-warn);
  background: var(--vg-warn-bg);
}
.custom-node--inspect {
  border-color: var(--vg-accent);
}
.custom-node--errored {
  border-color: var(--vg-error);
  background: var(--vg-error-bg);
}
.custom-node__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid var(--vg-border);
  background: var(--vg-surface-2);
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
}
.custom-node__label {
  font-weight: 600;
}
.custom-node__type {
  color: var(--vg-text-muted);
  font-size: 10px;
}
.custom-node__ports {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 6px 0;
}
.custom-node__inputs,
.custom-node__outputs {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.custom-node__outputs {
  align-items: flex-end;
}
.custom-node__port {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  position: relative;
}
.custom-node__port--out {
  flex-direction: row;
}
.custom-node__port-label {
  color: var(--vg-text);
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.2;
}
.custom-node__overlay-value {
  color: var(--vg-accent);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
}
.custom-node__handle {
  width: 8px;
  height: 8px;
  background: var(--vg-accent);
  border: 1px solid var(--vg-accent-hover);
}
.custom-node__footer {
  padding: 4px 10px;
  border-top: 1px solid var(--vg-border);
  font-size: 10px;
  color: var(--vg-text-muted);
  display: flex;
  justify-content: flex-end;
}
.custom-node__error {
  color: var(--vg-error);
  font-weight: 600;
}
.custom-node__duration {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
