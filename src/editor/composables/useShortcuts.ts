import { onMounted, onUnmounted } from "vue";
import { useHistoryStore } from "../stores/historyStore";
import { useClipboardStore } from "../stores/clipboardStore";
import { useEditorStore } from "../stores/editorStore";
import { useCanvasOperations } from "./useCanvasOperations";
import { useFileIO } from "./useFileIO";
import { openFilePicker } from "../openFile";

// Registers global keyboard shortcuts on the window:
//   Ctrl/Cmd + Z        undo
//   Ctrl/Cmd + Shift+Z  redo
//   Ctrl/Cmd + Y        redo (Windows-style)
//   Ctrl/Cmd + C        copy selection
//   Ctrl/Cmd + V        paste
//   Ctrl/Cmd + X        cut selection
//   Ctrl/Cmd + S        save current document as JSON download
//   Ctrl/Cmd + O        open file picker, load JSON via auto-detect dispatch
//   Delete / Backspace  remove selection
//   F                   fit-view (delegates to VueFlow once the canvas mounts)
// Shortcuts are skipped when the focused element is editable so typing in the
// property panel inputs and palette search is not stolen by these handlers.

const isEditable = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
};

export const useShortcuts = () => {
  const history = useHistoryStore();
  const clipboard = useClipboardStore();
  const editorStore = useEditorStore();
  const ops = useCanvasOperations();
  const fileIO = useFileIO();

  const handleOpen = async (): Promise<void> => {
    const file = await openFilePicker();
    if (!file) return;
    await fileIO.open(file);
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (isEditable(event.target)) return;

    const mod = event.ctrlKey || event.metaKey;

    if (mod && event.key === "z" && !event.shiftKey) {
      event.preventDefault();
      history.undo();
      return;
    }
    if ((mod && event.key === "y") || (mod && event.shiftKey && event.key === "Z")) {
      event.preventDefault();
      history.redo();
      return;
    }
    if (mod && event.key === "s") {
      event.preventDefault();
      fileIO.save("graph.json");
      return;
    }
    if (mod && event.key === "o") {
      event.preventDefault();
      void handleOpen();
      return;
    }
    if (mod && event.key === "c") {
      if (editorStore.selectedNodeIds.size === 0) return;
      event.preventDefault();
      clipboard.copy();
      return;
    }
    if (mod && event.key === "x") {
      if (editorStore.selectedNodeIds.size === 0) return;
      event.preventDefault();
      clipboard.cut();
      return;
    }
    if (mod && event.key === "v") {
      event.preventDefault();
      clipboard.paste();
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      if (editorStore.selectedNodeIds.size === 0 && editorStore.selectedEdgeIds.size === 0) return;
      event.preventDefault();
      ops.removeSelected();
      return;
    }
    if (!mod && (event.key === "f" || event.key === "F")) {
      event.preventDefault();
      editorStore.fitView();
      return;
    }
  };

  onMounted(() => {
    window.addEventListener("keydown", onKeydown);
  });
  onUnmounted(() => {
    window.removeEventListener("keydown", onKeydown);
  });
};
