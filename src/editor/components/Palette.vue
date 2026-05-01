<script setup lang="ts">
import { computed } from "vue";
import { defaultRegistry } from "../../registry/registry";
import { useCanvasOperations } from "../composables/useCanvasOperations";

const registry = defaultRegistry();
const ops = useCanvasOperations();

interface Group {
  category: string;
  items: { type: string; display_name: string }[];
}

const groups = computed<Group[]>(() => {
  const byCategory = new Map<string, Group>();
  for (const desc of registry.all()) {
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
  // Drop a new node at a fixed canvas-friendly position; the user can then
  // drag it. Phase 3 may swap this for cursor-relative placement.
  ops.addNodeAt(type, { x: 60, y: 60 });
};
</script>

<template>
  <div class="palette" data-testid="palette">
    <h2 class="palette__title">Nodes</h2>
    <div v-for="group in groups" :key="group.category" class="palette__group">
      <h3 class="palette__category">{{ group.category }}</h3>
      <button
        v-for="item in group.items"
        :key="item.type"
        type="button"
        class="palette__item"
        :data-testid="`palette-${item.type}`"
        @click="onAdd(item.type)"
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
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.palette__category {
  font-size: 10px;
  font-weight: 600;
  color: #6b7280;
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
  border: 1px solid #d0d7de;
  border-radius: 4px;
  background: #fff;
  font-size: 12px;
  cursor: pointer;
}
.palette__item:hover {
  background: #f1f5f9;
  border-color: #2563eb;
}
</style>
