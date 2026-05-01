<script setup lang="ts">
import TopBar from "./editor/components/TopBar.vue";
import Palette from "./editor/components/Palette.vue";
import CanvasView from "./editor/components/CanvasView.vue";
import PropertyPanel from "./editor/components/PropertyPanel.vue";
import ValidationPanel from "./editor/components/ValidationPanel.vue";
import { useLiveValidation } from "./editor/composables/useLiveValidation";
import { useShortcuts } from "./editor/composables/useShortcuts";

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
}
.editor-shell__body {
  display: grid;
  grid-template-columns: 240px 1fr 280px;
  min-height: 0;
}
.editor-shell__palette,
.editor-shell__properties {
  border-right: 1px solid var(--el-border-color-light, #eee);
  padding: 12px;
  overflow: auto;
}
.editor-shell__properties {
  border-right: none;
  border-left: 1px solid var(--el-border-color-light, #eee);
}
.editor-shell__centre {
  display: grid;
  grid-template-rows: 1fr auto;
  min-height: 0;
}
.editor-shell__canvas {
  position: relative;
  overflow: hidden;
  background: var(--el-bg-color-page, #fafafa);
}
</style>
