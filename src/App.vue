<script setup lang="ts">
// Phase 2 entry shell. CanvasView, Palette, PropertyPanel, and TopBar will
// fill the regions over the rest of Phase 2.
</script>

<template>
  <div class="editor-shell">
    <header class="editor-shell__top">n8n-port</header>
    <main class="editor-shell__body">
      <aside class="editor-shell__palette">Palette</aside>
      <section class="editor-shell__canvas">Canvas</section>
      <aside class="editor-shell__properties">Properties</aside>
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
.editor-shell__top {
  padding: 8px 12px;
  border-bottom: 1px solid var(--el-border-color-light, #ddd);
  font-weight: 600;
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
.editor-shell__canvas {
  position: relative;
  overflow: hidden;
  background: var(--el-bg-color-page, #fafafa);
}
</style>
