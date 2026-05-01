import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { Diagnostic } from "../../validator/diagnostics";

export const useValidationStore = defineStore("validation", () => {
  const diagnostics = ref<Diagnostic[]>([]);

  const errors = computed(() => diagnostics.value.filter((d) => d.severity === "error"));
  const warnings = computed(() => diagnostics.value.filter((d) => d.severity === "warning"));
  const hasErrors = computed(() => errors.value.length > 0);

  const setDiagnostics = (next: Diagnostic[]): void => {
    diagnostics.value = next;
  };

  return { diagnostics, errors, warnings, hasErrors, setDiagnostics };
});
