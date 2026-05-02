<script setup lang="ts">
import { computed } from "vue";
import { useValidationStore } from "../stores/validationStore";
import { useEditorStore } from "../stores/editorStore";

const validationStore = useValidationStore();
const editorStore = useEditorStore();

const grouped = computed(() => ({
  errors: validationStore.errors,
  warnings: validationStore.warnings,
}));

const onJump = (diag: { node_id?: number | undefined; edge_id?: string | undefined }): void => {
  if (diag.node_id !== undefined) {
    editorStore.selectNode(diag.node_id);
  } else if (diag.edge_id !== undefined) {
    editorStore.selectEdge(diag.edge_id);
  }
};

const totalCount = computed(() => validationStore.diagnostics.length);
</script>

<template>
  <div class="validation-panel" data-testid="validation-panel">
    <h2 class="validation-panel__title">
      Validation
      <span v-if="totalCount > 0" class="validation-panel__count">{{ totalCount }}</span>
    </h2>
    <div v-if="totalCount === 0" class="validation-panel__empty" data-testid="validation-empty">
      No problems detected.
    </div>
    <div v-else>
      <div v-if="grouped.errors.length > 0" class="validation-panel__group">
        <h3 class="validation-panel__heading validation-panel__heading--error">
          Errors ({{ grouped.errors.length }})
        </h3>
        <button
          v-for="(diag, i) in grouped.errors"
          :key="`err-${i}`"
          type="button"
          class="validation-panel__item validation-panel__item--error"
          :data-testid="`validation-error-${diag.code}`"
          @click="onJump(diag)"
        >
          <span class="validation-panel__code">{{ diag.code }}</span>
          <span class="validation-panel__message">{{ diag.message }}</span>
        </button>
      </div>
      <div v-if="grouped.warnings.length > 0" class="validation-panel__group">
        <h3 class="validation-panel__heading validation-panel__heading--warning">
          Warnings ({{ grouped.warnings.length }})
        </h3>
        <button
          v-for="(diag, i) in grouped.warnings"
          :key="`warn-${i}`"
          type="button"
          class="validation-panel__item validation-panel__item--warning"
          :data-testid="`validation-warning-${diag.code}`"
          @click="onJump(diag)"
        >
          <span class="validation-panel__code">{{ diag.code }}</span>
          <span class="validation-panel__message">{{ diag.message }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.validation-panel {
  border-top: 1px solid var(--vg-border);
  padding: 12px;
  background: var(--vg-surface);
  font-size: 12px;
  max-height: 220px;
  overflow: auto;
}
.validation-panel__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--vg-text);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.validation-panel__count {
  background: var(--vg-error);
  color: var(--vg-text-on-accent);
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 10px;
}
.validation-panel__empty {
  color: var(--vg-text-muted);
}
.validation-panel__heading {
  font-size: 10px;
  font-weight: 600;
  margin: 8px 0 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.validation-panel__heading--error {
  color: var(--vg-error);
}
.validation-panel__heading--warning {
  color: var(--vg-warn);
}
.validation-panel__item {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 8px;
  text-align: left;
  width: 100%;
  padding: 4px 6px;
  margin-bottom: 2px;
  border: 1px solid transparent;
  background: transparent;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
}
.validation-panel__item:hover {
  background: var(--vg-surface-hover);
  border-color: var(--vg-border);
}
.validation-panel__code {
  color: var(--vg-text-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.validation-panel__message {
  color: var(--vg-text);
}
.validation-panel__item--error .validation-panel__code {
  color: var(--vg-error);
}
.validation-panel__item--warning .validation-panel__code {
  color: var(--vg-warn);
}
</style>
