<script setup lang="ts">
import { computed, ref } from "vue";
import { defaultRegistry } from "../../registry/registry";
import { useCanvasOperations } from "../composables/useCanvasOperations";
import { PALETTE_DRAG_MIME } from "../paletteDragMime";

const registry = defaultRegistry();
const ops = useCanvasOperations();

const search = ref("");

interface Group {
  category: string;
  items: { type: string; display_name: string }[];
}

const groups = computed<Group[]>(() => {
  const q = search.value.trim().toLowerCase();
  const byCategory = new Map<string, Group>();
  for (const desc of registry.all()) {
    const matches =
      q === "" ||
      desc.type.toLowerCase().includes(q) ||
      desc.display_name.toLowerCase().includes(q) ||
      desc.category.toLowerCase().includes(q);
    if (!matches) continue;
    let g = byCategory.get(desc.category);
    if (!g) {
      g = { category: desc.category, items: [] };
      byCategory.set(desc.category, g);
    }
    g.items.push({ type: desc.type, display_name: desc.display_name });
  }
  return [...byCategory.values()].sort((a, b) => a.category.localeCompare(b.category));
});

const onAdd = (type: string): void => {
  ops.addNodeAt(type, { x: 60, y: 60 });
};

const onDragStart = (event: DragEvent, type: string): void => {
  if (!event.dataTransfer) return;
  event.dataTransfer.setData(PALETTE_DRAG_MIME, type);
  event.dataTransfer.effectAllowed = "copy";
};
</script>

<template>
  <div class="palette" data-testid="palette">
    <h2 class="palette__title">Nodes</h2>
    <input
      v-model="search"
      type="search"
      placeholder="Search…"
      class="palette__search"
      data-testid="palette-search"
    />
    <div v-if="groups.length === 0" class="palette__empty">No matches.</div>
    <div v-for="group in groups" :key="group.category" class="palette__group">
      <h3 class="palette__category">{{ group.category }}</h3>
      <button
        v-for="item in group.items"
        :key="item.type"
        type="button"
        class="palette__item"
        :data-testid="`palette-${item.type}`"
        draggable="true"
        @click="onAdd(item.type)"
        @dragstart="onDragStart($event, item.type)"
      >
        {{ item.display_name }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.palette__title {
  font-size: 12px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--vg-text);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.palette__search {
  width: 100%;
  padding: 4px 8px;
  margin-bottom: 8px;
  font-size: 12px;
  border: 1px solid var(--vg-border);
  border-radius: 4px;
}
.palette__empty {
  color: var(--vg-text-muted);
  font-size: 11px;
  margin: 6px 0;
}
.palette__category {
  font-size: 10px;
  font-weight: 600;
  color: var(--vg-text-muted);
  margin: 12px 0 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.palette__item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 10px;
  margin-bottom: 4px;
  border: 1px solid var(--vg-border);
  border-radius: 4px;
  background: var(--vg-surface);
  color: var(--vg-text);
  font-size: 12px;
  cursor: pointer;
}
.palette__item:hover {
  background: var(--vg-surface-2);
  border-color: var(--vg-accent);
}
</style>
