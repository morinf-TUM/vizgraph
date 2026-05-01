<script setup lang="ts">
import { ref } from "vue";
import { useDocumentStore } from "../stores/documentStore";
import { useEditorStore } from "../stores/editorStore";
import { useHistoryStore } from "../stores/historyStore";
import { useFileIO } from "../composables/useFileIO";
import { useAutoLayout } from "../composables/useAutoLayout";

const docStore = useDocumentStore();
const editorStore = useEditorStore();
const history = useHistoryStore();
const fileIO = useFileIO();
const autoLayout = useAutoLayout();

const fileInput = ref<HTMLInputElement | null>(null);
const error = ref<string | null>(null);

const onNew = (): void => {
  docStore.newDocument();
  editorStore.clearSelection();
  editorStore.markClean();
  history.clear();
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
  if (!result.ok) {
    error.value = result.reason;
  } else {
    error.value = null;
  }
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
</script>

<template>
  <div class="top-bar" data-testid="top-bar">
    <div class="top-bar__left">
      <strong>n8n-port</strong>
      <span v-if="editorStore.dirty" class="top-bar__dirty">unsaved</span>
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
      <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        class="top-bar__file-input"
        data-testid="topbar-file-input"
        @change="onFileSelected"
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
  border-bottom: 1px solid #e5e7eb;
}
.top-bar__left {
  display: flex;
  gap: 8px;
  align-items: baseline;
}
.top-bar__dirty {
  color: #b45309;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.top-bar__actions {
  display: flex;
  gap: 6px;
  align-items: center;
}
.top-bar__sep {
  width: 1px;
  height: 18px;
  background: #d0d7de;
  margin: 0 4px;
}
.top-bar__actions button {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}
.top-bar__actions button:disabled {
  color: #9ca3af;
  cursor: not-allowed;
}
.top-bar__actions button:not(:disabled):hover {
  background: #f1f5f9;
}
.top-bar__file-input {
  display: none;
}
.top-bar__error {
  margin-left: auto;
  color: #b91c1c;
  font-size: 12px;
}
</style>
