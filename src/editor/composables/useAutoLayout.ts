import { useDocumentStore } from "../stores/documentStore";
import { useEditorStore } from "../stores/editorStore";
import { useHistoryStore } from "../stores/historyStore";
import { layoutGraph } from "../autoLayout";

export const useAutoLayout = () => {
  const docStore = useDocumentStore();
  const editorStore = useEditorStore();
  const history = useHistoryStore();

  const tidy = (): void => {
    if (docStore.nodes.length === 0) return;
    const positions = layoutGraph(docStore.doc);
    history.transact("Tidy layout", () => {
      for (const node of docStore.nodes) {
        const p = positions.get(node.id);
        if (p) docStore.moveNode(node.id, p);
      }
      editorStore.markDirty();
    });
  };

  return { tidy };
};
