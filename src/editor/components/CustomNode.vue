<script setup lang="ts">
import { computed } from "vue";
import { Handle, Position as HandlePosition } from "@vue-flow/core";
import type { GraphDocument, GraphNode } from "../../document/types";
import {
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
} from "../../document/subgraph";
import { defaultRegistry } from "../../registry/registry";
import { useExecutionStore } from "../stores/executionStore";

interface Props {
  data: { node: GraphNode };
}
const props = defineProps<Props>();

const registry = defaultRegistry();
const executionStore = useExecutionStore();

const node = computed(() => props.data.node);

const branch = computed<"subgraph" | "subgraphInput" | "subgraphOutput" | "regular">(() => {
  switch (node.value.type) {
    case SUBGRAPH_NODE_TYPE:
      return "subgraph";
    case SUBGRAPH_INPUT_NODE_TYPE:
      return "subgraphInput";
    case SUBGRAPH_OUTPUT_NODE_TYPE:
      return "subgraphOutput";
    default:
      return "regular";
  }
});

const desc = computed(() =>
  branch.value === "regular" ? registry.get(node.value.type) : undefined,
);
const inputs = computed(() => desc.value?.inputs ?? []);
const outputs = computed(() => desc.value?.outputs ?? []);
const label = computed(() => node.value.name ?? node.value.type);

const overlay = computed(() => {
  if (branch.value !== "regular") return undefined;
  if (executionStore.mode !== "inspect") return undefined;
  return executionStore.overlayByLocalNodeId.get(node.value.id);
});

const subgraphLabel = computed(() => node.value.name ?? `Sub-graph #${node.value.id}`);

const innerPseudoNodes = (kind: string) => {
  const children = (node.value.parameters as { children?: GraphDocument }).children;
  if (!children) return [];
  return children.graph.nodes
    .filter((n) => n.type === kind)
    .slice()
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
    .map((n) => (n.parameters as { name?: string }).name)
    .filter((name): name is string => typeof name === "string" && name.length > 0)
    .map((name) => ({ name }));
};

const subgraphInputs = computed(() =>
  branch.value === "subgraph" ? innerPseudoNodes(SUBGRAPH_INPUT_NODE_TYPE) : [],
);
const subgraphOutputs = computed(() =>
  branch.value === "subgraph" ? innerPseudoNodes(SUBGRAPH_OUTPUT_NODE_TYPE) : [],
);

const pseudoName = computed(() => (node.value.parameters as { name?: string }).name ?? "");
const pseudoPortType = computed(
  () => (node.value.parameters as { portType?: string }).portType ?? "",
);

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
    v-if="branch === 'regular'"
    class="custom-node"
    :data-node-type="data.node.type"
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

  <div
    v-else-if="branch === 'subgraph'"
    class="custom-node custom-node--subgraph"
    :data-node-type="data.node.type"
  >
    <div class="custom-node__header">
      <span class="custom-node__label">{{ subgraphLabel }}</span>
      <span class="custom-node__type">{{ data.node.type }}</span>
    </div>
    <div class="custom-node__ports">
      <div class="custom-node__inputs">
        <div v-for="port in subgraphInputs" :key="`sub-in-${port.name}`" class="custom-node__port">
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
          v-for="port in subgraphOutputs"
          :key="`sub-out-${port.name}`"
          class="custom-node__port custom-node__port--out"
        >
          <span class="custom-node__port-label">{{ port.name }}</span>
          <Handle
            :id="port.name"
            type="source"
            :position="HandlePosition.Right"
            class="custom-node__handle"
          />
        </div>
      </div>
    </div>
  </div>

  <div
    v-else-if="branch === 'subgraphInput'"
    class="pseudo-node pseudo-node--input"
    :data-node-type="data.node.type"
  >
    <span class="pseudo-node__glyph">▶</span>
    <span v-if="pseudoName" class="pseudo-node__name">{{ pseudoName }}</span>
    <span v-else class="pseudo-node__name pseudo-node__missing">(unnamed)</span>
    <span class="pseudo-node__sep">:</span>
    <span v-if="pseudoPortType" class="pseudo-node__porttype">{{ pseudoPortType }}</span>
    <span v-else class="pseudo-node__porttype pseudo-node__missing">(no type)</span>
    <Handle
      v-if="pseudoName"
      :id="pseudoName"
      type="source"
      :position="HandlePosition.Right"
      class="custom-node__handle pseudo-node__handle"
    />
  </div>

  <div v-else class="pseudo-node pseudo-node--output" :data-node-type="data.node.type">
    <Handle
      v-if="pseudoName"
      :id="pseudoName"
      type="target"
      :position="HandlePosition.Left"
      class="custom-node__handle pseudo-node__handle"
    />
    <span v-if="pseudoName" class="pseudo-node__name">{{ pseudoName }}</span>
    <span v-else class="pseudo-node__name pseudo-node__missing">(unnamed)</span>
    <span class="pseudo-node__sep">:</span>
    <span v-if="pseudoPortType" class="pseudo-node__porttype">{{ pseudoPortType }}</span>
    <span v-else class="pseudo-node__porttype pseudo-node__missing">(no type)</span>
    <span class="pseudo-node__glyph">▶</span>
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
.custom-node--subgraph {
  border-style: dashed;
  border-color: var(--vg-accent);
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
  border: 1px solid var(--vg-border-strong);
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
.pseudo-node {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--vg-surface-2);
  border: 1px solid var(--vg-border);
  border-radius: 4px;
  font-size: 11px;
  color: var(--vg-text);
  box-shadow: var(--vg-shadow-sm);
  position: relative;
}
.pseudo-node__glyph {
  color: var(--vg-accent);
  font-size: 10px;
}
.pseudo-node__name {
  font-weight: 600;
}
.pseudo-node__sep {
  color: var(--vg-text-muted);
}
.pseudo-node__porttype {
  color: var(--vg-text-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.pseudo-node__missing {
  color: var(--vg-text-muted);
  font-style: italic;
}
</style>
