<script setup lang="ts">
import { computed, ref } from "vue";
import { useDocumentStore } from "../stores/documentStore";
import { useEditorStore } from "../stores/editorStore";
import { useHistoryStore } from "../stores/historyStore";
import { useExecutionStore } from "../stores/executionStore";
import { useFileIO } from "../composables/useFileIO";
import { useAutoLayout } from "../composables/useAutoLayout";
import { useRunResultImport } from "../composables/useRunResultImport";
import { useCanvasOperations } from "../composables/useCanvasOperations";

const docStore = useDocumentStore();
const editorStore = useEditorStore();
const history = useHistoryStore();
const execution = useExecutionStore();
const fileIO = useFileIO();
const autoLayout = useAutoLayout();
const runResultImport = useRunResultImport();
const ops = useCanvasOperations();

const fileInput = ref<HTMLInputElement | null>(null);
const runResultInput = ref<HTMLInputElement | null>(null);
const error = ref<string | null>(null);

const onNew = (): void => {
  docStore.newDocument();
  editorStore.clearSelection();
  editorStore.markClean();
  history.clear();
  execution.clearResult();
  error.value = null;
};

const onOpen = (): void => {
  fileInput.value?.click();
};

const onFileSelected = async (event: Event): Promise<void> => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  const result = await fileIO.open(file);
  error.value = result.ok ? null : result.reason;
  target.value = "";
};

const onSave = (): void => {
  fileIO.save("graph.json");
  error.value = null;
};

const onSaveAs = (): void => {
  const name = window.prompt("Save as filename", "graph.json");
  if (!name) return;
  fileIO.save(name);
  error.value = null;
};

const onUndo = (): void => {
  history.undo();
};
const onRedo = (): void => {
  history.redo();
};
const onTidy = (): void => {
  autoLayout.tidy();
};

const onAddComment = (): void => {
  ops.addCommentAt("New comment", { x: 80, y: 80 });
};

const onImportRun = (): void => {
  runResultInput.value?.click();
};

const onRunResultSelected = async (event: Event): Promise<void> => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  const result = await runResultImport.importFile(file);
  error.value = result.ok ? null : result.reason;
  target.value = "";
};

const onClearRun = (): void => {
  execution.clearResult();
};

const onToggleMode = (): void => {
  execution.toggleMode();
};

const onTickPrev = (): void => {
  if (execution.tickIndex > 0) execution.setTickIndex(execution.tickIndex - 1);
};
const onTickNext = (): void => {
  if (execution.tickIndex < execution.tickCount - 1) {
    execution.setTickIndex(execution.tickIndex + 1);
  }
};

const showTickControls = computed(() => execution.tickCount > 1);
</script>

<template>
  <div class="top-bar" data-testid="top-bar">
    <div class="top-bar__left">
      <strong>n8n-port</strong>
      <span v-if="editorStore.dirty" class="top-bar__dirty">unsaved</span>
      <span
        class="top-bar__mode"
        :class="`top-bar__mode--${execution.mode}`"
        data-testid="top-bar-mode"
      >
        {{ execution.mode }}
      </span>
    </div>
    <div class="top-bar__actions">
      <button type="button" data-testid="topbar-new" @click="onNew">New</button>
      <button type="button" data-testid="topbar-open" @click="onOpen">Open</button>
      <button type="button" data-testid="topbar-save" @click="onSave">Save</button>
      <button type="button" data-testid="topbar-saveas" @click="onSaveAs">Save As</button>
      <span class="top-bar__sep" />
      <button type="button" data-testid="topbar-undo" :disabled="!history.canUndo" @click="onUndo">
        Undo
      </button>
      <button type="button" data-testid="topbar-redo" :disabled="!history.canRedo" @click="onRedo">
        Redo
      </button>
      <span class="top-bar__sep" />
      <button type="button" data-testid="topbar-tidy" @click="onTidy">Tidy</button>
      <button type="button" data-testid="topbar-add-comment" @click="onAddComment">Comment</button>
      <span class="top-bar__sep" />
      <button type="button" data-testid="topbar-import-run" @click="onImportRun">
        Import RunResult
      </button>
      <button
        type="button"
        data-testid="topbar-toggle-mode"
        :disabled="!execution.result"
        @click="onToggleMode"
      >
        {{ execution.mode === "inspect" ? "Edit mode" : "Inspect mode" }}
      </button>
      <button
        v-if="execution.result"
        type="button"
        data-testid="topbar-clear-run"
        @click="onClearRun"
      >
        Clear run
      </button>
      <template v-if="showTickControls">
        <span class="top-bar__sep" />
        <button
          type="button"
          data-testid="topbar-tick-prev"
          :disabled="execution.tickIndex === 0"
          @click="onTickPrev"
        >
          ◀
        </button>
        <span class="top-bar__tick" data-testid="topbar-tick-label">
          tick {{ execution.tickIndex }} / {{ execution.tickCount - 1 }}
        </span>
        <button
          type="button"
          data-testid="topbar-tick-next"
          :disabled="execution.tickIndex >= execution.tickCount - 1"
          @click="onTickNext"
        >
          ▶
        </button>
      </template>
      <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        class="top-bar__file-input"
        data-testid="topbar-file-input"
        @change="onFileSelected"
      />
      <input
        ref="runResultInput"
        type="file"
        accept="application/json,.json"
        class="top-bar__file-input"
        data-testid="topbar-runresult-input"
        @change="onRunResultSelected"
      />
    </div>
    <div v-if="error" class="top-bar__error" data-testid="topbar-error">{{ error }}</div>
  </div>
</template>

<style scoped>
.top-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--vg-border);
  background: var(--vg-surface);
  color: var(--vg-text);
}
.top-bar__left {
  display: flex;
  gap: 8px;
  align-items: baseline;
}
.top-bar__dirty {
  color: var(--vg-warn);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.top-bar__mode {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid;
}
.top-bar__mode--edit {
  border-color: var(--vg-border);
  color: var(--vg-text-muted);
  background: var(--vg-surface);
}
.top-bar__mode--inspect {
  border-color: var(--vg-accent);
  color: var(--vg-accent-hover);
  background: var(--vg-accent-bg);
}
.top-bar__actions {
  display: flex;
  gap: 6px;
  align-items: center;
}
.top-bar__sep {
  width: 1px;
  height: 18px;
  background: var(--vg-border);
  margin: 0 4px;
}
.top-bar__actions button {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid var(--vg-border);
  border-radius: 4px;
  background: var(--vg-surface);
  color: var(--vg-text);
  cursor: pointer;
}
.top-bar__actions button:disabled {
  color: var(--vg-text-subtle);
  cursor: not-allowed;
}
.top-bar__actions button:not(:disabled):hover {
  background: var(--vg-surface-2);
}
.top-bar__file-input {
  display: none;
}
.top-bar__tick {
  font-size: 11px;
  color: var(--vg-text-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.top-bar__error {
  margin-left: auto;
  color: var(--vg-error);
  font-size: 12px;
}
</style>
