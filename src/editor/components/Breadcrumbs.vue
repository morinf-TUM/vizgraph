<script setup lang="ts">
import { computed } from "vue";
import { useEditorStore } from "../stores/editorStore";
import { useDocumentStore } from "../stores/documentStore";
import { SUBGRAPH_NODE_TYPE } from "../../document/subgraph";

const editor = useEditorStore();
const doc = useDocumentStore();

interface Crumb {
  label: string;
  path: number[];
}

const crumbs = computed<Crumb[]>(() => {
  const out: Crumb[] = [{ label: "Root", path: [] }];
  let g = doc.doc.graph;
  for (let i = 0; i < editor.currentPath.length; i++) {
    const id = editor.currentPath[i]!;
    const node = g.nodes.find((n) => n.id === id);
    const label = node?.name ?? `Subgraph #${String(id)}`;
    out.push({ label, path: editor.currentPath.slice(0, i + 1) });
    if (node?.type === SUBGRAPH_NODE_TYPE) {
      const child = (node.parameters as { children?: { graph: typeof g } }).children;
      if (child) g = child.graph;
    }
  }
  return out;
});

const goTo = (path: number[]): void => editor.setCurrentPath(path);
</script>

<template>
  <nav class="breadcrumbs" aria-label="Sub-graph navigation">
    <template v-for="(c, idx) in crumbs" :key="idx">
      <span v-if="idx > 0" class="breadcrumbs__sep" aria-hidden="true">›</span>
      <button
        type="button"
        class="breadcrumbs__crumb"
        :class="{ 'breadcrumbs__crumb--current': idx === crumbs.length - 1 }"
        :aria-current="idx === crumbs.length - 1 ? 'page' : undefined"
        @click="goTo(c.path)"
      >
        {{ c.label }}
      </button>
    </template>
  </nav>
</template>

<style scoped>
.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: var(--vg-surface);
  border-bottom: 1px solid var(--vg-border);
  color: var(--vg-text);
  font-size: 0.85rem;
}
.breadcrumbs__crumb {
  background: none;
  border: none;
  color: var(--vg-text);
  cursor: pointer;
  padding: 0.15rem 0.35rem;
  border-radius: 3px;
}
.breadcrumbs__crumb:hover {
  background: var(--vg-surface-hover);
}
.breadcrumbs__crumb:focus-visible {
  outline: 2px solid var(--vg-accent);
}
.breadcrumbs__crumb--current {
  color: var(--vg-text-muted);
  cursor: default;
}
.breadcrumbs__sep {
  color: var(--vg-text-subtle);
}
</style>
