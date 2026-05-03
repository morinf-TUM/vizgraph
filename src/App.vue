<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import TopBar from "./editor/components/TopBar.vue";
import Palette from "./editor/components/Palette.vue";
import PropertyPanel from "./editor/components/PropertyPanel.vue";
import ValidationPanel from "./editor/components/ValidationPanel.vue";
import Breadcrumbs from "./editor/components/Breadcrumbs.vue";
import { useLiveValidation } from "./editor/composables/useLiveValidation";
import { useShortcuts } from "./editor/composables/useShortcuts";

// CanvasView pulls in VueFlow + the @vue-flow/* companion packages, which is
// the largest single chunk in the bundle. Splitting it out lets the editor
// shell (TopBar / Palette / Property / Validation panels) paint immediately
// while the canvas chunk loads in the background.
const CanvasView = defineAsyncComponent({
  loader: () => import("./editor/components/CanvasView.vue"),
  loadingComponent: {
    template: `<div class="canvas-loading" data-testid="canvas-loading">Loading canvas…</div>`,
  },
});

useLiveValidation();
useShortcuts();
</script>

<template>
  <div class="editor-shell">
    <TopBar />
    <main class="editor-shell__body">
      <aside class="editor-shell__palette">
        <Palette />
      </aside>
      <section class="editor-shell__centre">
        <Breadcrumbs />
        <div class="editor-shell__canvas">
          <CanvasView />
        </div>
        <ValidationPanel />
      </section>
      <aside class="editor-shell__properties">
        <PropertyPanel />
      </aside>
    </main>
  </div>
</template>

<style scoped>
.editor-shell {
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100vh;
  width: 100vw;
  background: var(--vg-bg);
  color: var(--vg-text);
}
.editor-shell__body {
  display: grid;
  grid-template-columns: 240px 1fr 280px;
  min-height: 0;
}
.editor-shell__palette,
.editor-shell__properties {
  border-right: 1px solid var(--el-border-color-light, var(--vg-border));
  padding: 12px;
  overflow: auto;
  background: var(--vg-surface);
  color: var(--vg-text);
}
.editor-shell__properties {
  border-right: none;
  border-left: 1px solid var(--el-border-color-light, var(--vg-border));
}
.editor-shell__centre {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 0;
}
.editor-shell__canvas {
  position: relative;
  overflow: hidden;
  background: var(--el-bg-color-page, var(--vg-bg));
}
</style>

<style>
.canvas-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--vg-text-muted);
  font-size: 12px;
}
</style>
