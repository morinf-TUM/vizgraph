import { useExecutionStore } from "../stores/executionStore";
import { RunResultSchema } from "../../document/runresult";

export const useRunResultImport = () => {
  const executionStore = useExecutionStore();

  const importFile = async (file: File): Promise<{ ok: true } | { ok: false; reason: string }> => {
    let text: string;
    try {
      text = await file.text();
    } catch (err) {
      return { ok: false, reason: `Failed to read file: ${String(err)}` };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return { ok: false, reason: `Not valid JSON: ${String(err)}` };
    }
    const result = RunResultSchema.safeParse(parsed);
    if (!result.success) {
      return { ok: false, reason: result.error.message };
    }
    executionStore.setResult(result.data);
    return { ok: true };
  };

  return { importFile };
};
