import { onUnmounted, watch } from "vue";
import { useDocumentStore } from "../stores/documentStore";
import { useValidationStore } from "../stores/validationStore";
import { defaultRegistry } from "../../registry/registry";
import { validate } from "../../validator/validate";

const DEBOUNCE_MS = 200;

// Mounts a debounced watcher on docStore.doc that runs validate() and writes
// the result to validationStore. The 200 ms debounce matches spec section 8
// (Triggers: live on edit, debounced 200 ms). Unmount stops the watcher and
// cancels any pending tick.
export const useLiveValidation = () => {
  const docStore = useDocumentStore();
  const validationStore = useValidationStore();
  const registry = defaultRegistry();

  let pending: ReturnType<typeof setTimeout> | undefined;

  const runNow = (): void => {
    validationStore.setDiagnostics(validate(docStore.doc, registry));
  };

  const scheduleRun = (): void => {
    if (pending !== undefined) clearTimeout(pending);
    pending = setTimeout(() => {
      pending = undefined;
      runNow();
    }, DEBOUNCE_MS);
  };

  // Run once on mount so the panel reflects the initial document.
  runNow();

  const stop = watch(() => docStore.doc, scheduleRun, { deep: true });

  onUnmounted(() => {
    if (pending !== undefined) clearTimeout(pending);
    stop();
  });

  return { runNow };
};
