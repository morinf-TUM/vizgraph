<script setup lang="ts">
import { computed } from "vue";
import { useDocumentStore } from "../stores/documentStore";
import { useEditorStore } from "../stores/editorStore";
import { useCanvasOperations } from "../composables/useCanvasOperations";
import { defaultRegistry } from "../../registry/registry";

const docStore = useDocumentStore();
const editorStore = useEditorStore();
const ops = useCanvasOperations();
const registry = defaultRegistry();

const selectedNode = computed(() => {
  if (editorStore.selectedNodeIds.size !== 1) return undefined;
  const id = [...editorStore.selectedNodeIds][0];
  if (id === undefined) return undefined;
  return docStore.nodes.find((n) => n.id === id);
});

const selectedDesc = computed(() =>
  selectedNode.value ? registry.get(selectedNode.value.type) : undefined,
);

const constantValue = computed<number>(() => {
  const n = selectedNode.value;
  if (!n || n.type !== "Constant") return 0;
  const v = n.parameters.value;
  return typeof v === "number" ? v : 0;
});

const onValueInput = (event: Event): void => {
  const n = selectedNode.value;
  if (!n) return;
  const target = event.target as HTMLInputElement;
  const next = Number(target.value);
  if (!Number.isFinite(next)) return;
  ops.updateParameter(n.id, "value", Math.trunc(next));
};

const onNameInput = (event: Event): void => {
  const n = selectedNode.value;
  if (!n) return;
  const target = event.target as HTMLInputElement;
  ops.renameNode(n.id, target.value === "" ? undefined : target.value);
};
</script>

<template>
  <div class="property-panel" data-testid="property-panel">
    <h2 class="property-panel__title">Properties</h2>
    <div v-if="!selectedNode" class="property-panel__empty">Select a node to edit it.</div>
    <div v-else>
      <div class="property-panel__field">
        <label class="property-panel__label">id</label>
        <span class="property-panel__readonly">{{ selectedNode.id }}</span>
      </div>
      <div class="property-panel__field">
        <label class="property-panel__label">type</label>
        <span class="property-panel__readonly">{{ selectedNode.type }}</span>
      </div>
      <div class="property-panel__field">
        <label class="property-panel__label">name</label>
        <input
          class="property-panel__input"
          data-testid="property-name"
          :value="selectedNode.name ?? ''"
          @input="onNameInput"
        />
      </div>
      <div v-if="selectedNode.type === 'Constant'" class="property-panel__field">
        <label class="property-panel__label">value</label>
        <input
          class="property-panel__input"
          data-testid="property-constant-value"
          type="number"
          step="1"
          :value="constantValue"
          @input="onValueInput"
        />
      </div>
      <div v-if="!selectedDesc" class="property-panel__warning">
        Unknown node type — properties not editable.
      </div>
    </div>
  </div>
</template>

<style scoped>
.property-panel__title {
  font-size: 12px;
  font-weight: 600;
  margin: 0 0 8px;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.property-panel__empty,
.property-panel__warning {
  color: #6b7280;
  font-size: 12px;
}
.property-panel__warning {
  color: #b91c1c;
  margin-top: 8px;
}
.property-panel__field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
}
.property-panel__label {
  font-size: 10px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.property-panel__readonly {
  font-size: 12px;
  color: #111827;
}
.property-panel__input {
  font-size: 12px;
  padding: 4px 6px;
  border: 1px solid #d0d7de;
  border-radius: 4px;
}
</style>
