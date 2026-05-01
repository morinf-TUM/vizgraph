import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { GraphDocument } from "../../document/types";
import { useDocumentStore } from "./documentStore";

// Snapshot/Memento variant of the command pattern (ADR-0004): each user-facing
// transaction stashes the pre-action document JSON on an undo stack, then runs
// the mutation. Redo holds post-action JSONs of undone transactions. JSON
// strings are used so deep-cloning is cheap and reactivity hazards from
// sharing objects across snapshots are eliminated. MAX_DEPTH bounds memory
// growth.
const MAX_DEPTH = 100;

const snapshot = (doc: GraphDocument): string => JSON.stringify(doc);
const restore = (json: string): GraphDocument => JSON.parse(json) as GraphDocument;

export const useHistoryStore = defineStore("history", () => {
  const docStore = useDocumentStore();

  const undoStack = ref<string[]>([]);
  const redoStack = ref<string[]>([]);

  const canUndo = computed(() => undoStack.value.length > 0);
  const canRedo = computed(() => redoStack.value.length > 0);

  const transact = <T>(_label: string, fn: () => T): T => {
    const before = snapshot(docStore.doc);
    const result = fn();
    undoStack.value.push(before);
    if (undoStack.value.length > MAX_DEPTH) undoStack.value.shift();
    redoStack.value = [];
    return result;
  };

  const undo = (): boolean => {
    const before = undoStack.value.pop();
    if (before === undefined) return false;
    redoStack.value.push(snapshot(docStore.doc));
    docStore.replaceDocument(restore(before));
    return true;
  };

  const redo = (): boolean => {
    const after = redoStack.value.pop();
    if (after === undefined) return false;
    undoStack.value.push(snapshot(docStore.doc));
    docStore.replaceDocument(restore(after));
    return true;
  };

  const clear = (): void => {
    undoStack.value = [];
    redoStack.value = [];
  };

  return { canUndo, canRedo, transact, undo, redo, clear };
});
