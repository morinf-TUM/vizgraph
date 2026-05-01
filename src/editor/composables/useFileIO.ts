import { useDocumentStore } from "../stores/documentStore";
import { useEditorStore } from "../stores/editorStore";
import { saveVersioned } from "../../serializer/versioned";
import { loadGraph } from "../../serializer/index";
import { GraphDocumentSchema } from "../../document/types";

export const useFileIO = () => {
  const docStore = useDocumentStore();
  const editorStore = useEditorStore();

  const save = (filename = "graph.json"): void => {
    const json = saveVersioned(docStore.doc);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    editorStore.markClean();
  };

  const open = async (file: File): Promise<{ ok: true } | { ok: false; reason: string }> => {
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
    const result = loadGraph(parsed);
    if (!result.success) {
      return { ok: false, reason: result.error };
    }
    // Re-parse through the schema as belt-and-suspenders: load() already does
    // this but we want a fresh, fully-typed copy independent of the loader's
    // internal state.
    const fresh = GraphDocumentSchema.safeParse(result.data);
    if (!fresh.success) {
      return { ok: false, reason: fresh.error.message };
    }
    docStore.replaceDocument(fresh.data);
    editorStore.clearSelection();
    editorStore.markClean();
    return { ok: true };
  };

  return { save, open };
};
