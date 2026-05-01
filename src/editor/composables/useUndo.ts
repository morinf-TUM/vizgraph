import { useHistoryStore } from "../stores/historyStore";

// Thin façade for keyboard-shortcut wiring and the TopBar undo/redo buttons.
// The historyStore already owns the stacks; this composable exists so the
// shortcut layer can stay decoupled from store internals.
export const useUndo = () => {
  const history = useHistoryStore();
  return {
    canUndo: () => history.canUndo,
    canRedo: () => history.canRedo,
    undo: () => history.undo(),
    redo: () => history.redo(),
  };
};
