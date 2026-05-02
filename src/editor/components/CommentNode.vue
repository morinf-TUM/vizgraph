<script setup lang="ts">
import { ref, watch } from "vue";
import type { Comment } from "../../document/types";
import { useCanvasOperations } from "../composables/useCanvasOperations";

interface Props {
  data: { comment: Comment };
}
const props = defineProps<Props>();

const ops = useCanvasOperations();

const editing = ref(false);
const draft = ref(props.data.comment.text);

// Sync the local draft with the store when the comment changes from outside
// (e.g. an undo / redo). We don't want to clobber the user's in-progress
// edit, so this only runs while not in edit mode.
watch(
  () => props.data.comment.text,
  (next) => {
    if (!editing.value) draft.value = next;
  },
);

const startEdit = (): void => {
  editing.value = true;
  draft.value = props.data.comment.text;
};

const commit = (): void => {
  editing.value = false;
  if (draft.value !== props.data.comment.text) {
    ops.editCommentText(props.data.comment.id, draft.value);
  }
};

const cancel = (): void => {
  editing.value = false;
  draft.value = props.data.comment.text;
};

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === "Escape") {
    cancel();
  } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    commit();
  }
};
</script>

<template>
  <div
    class="comment-node"
    :style="data.comment.color ? { borderColor: data.comment.color } : undefined"
    :data-testid="`comment-${data.comment.id}`"
    @dblclick="startEdit"
  >
    <textarea
      v-if="editing"
      v-model="draft"
      class="comment-node__editor"
      :data-testid="`comment-editor-${data.comment.id}`"
      autofocus
      @blur="commit"
      @keydown="onKeydown"
    />
    <div v-else class="comment-node__text" :data-testid="`comment-text-${data.comment.id}`">
      {{ data.comment.text || "(empty comment — double-click to edit)" }}
    </div>
  </div>
</template>

<style scoped>
.comment-node {
  min-width: 160px;
  min-height: 40px;
  padding: 8px 10px;
  border: 1px dashed var(--vg-warn);
  border-radius: 6px;
  background: var(--vg-warn-bg);
  font-size: 12px;
  color: var(--vg-text);
  white-space: pre-wrap;
  word-break: break-word;
  box-shadow: var(--vg-shadow-sm);
}
.comment-node__text {
  cursor: text;
}
.comment-node__editor {
  width: 100%;
  min-height: 60px;
  font: inherit;
  color: inherit;
  background: transparent;
  border: none;
  outline: none;
  resize: vertical;
}
</style>
