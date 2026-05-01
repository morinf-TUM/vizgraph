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
  background: #fff;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  font-size: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
.custom-node--unknown {
  border-color: #d97706;
  background: #fff7ed;
}
.custom-node--inspect {
  border-color: #2563eb;
}
.custom-node--errored {
  border-color: #b91c1c;
  background: #fef2f2;
}
.custom-node__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid #eaecef;
  background: #f6f8fa;
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
}
.custom-node__label {
  font-weight: 600;
}
.custom-node__type {
  color: #6b7280;
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
  color: #374151;
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.2;
}
.custom-node__overlay-value {
  color: #2563eb;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
}
.custom-node__handle {
  width: 8px;
  height: 8px;
  background: #2563eb;
  border: 1px solid #1e40af;
}
.custom-node__footer {
  padding: 4px 10px;
  border-top: 1px solid #eaecef;
  font-size: 10px;
  color: #6b7280;
  display: flex;
  justify-content: flex-end;
}
.custom-node__error {
  color: #b91c1c;
  font-weight: 600;
}
.custom-node__duration {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
