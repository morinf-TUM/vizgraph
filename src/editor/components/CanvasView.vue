<script setup lang="ts">
import { computed } from "vue";
import { VueFlow, type Connection, type EdgeChange, type NodeChange } from "@vue-flow/core";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import { MiniMap } from "@vue-flow/minimap";
import { useDocumentStore } from "../stores/documentStore";
import { useEditorStore } from "../stores/editorStore";
import { useCanvasOperations } from "../composables/useCanvasOperations";
import CustomNode from "./CustomNode.vue";

const docStore = useDocumentStore();
const editorStore = useEditorStore();
const ops = useCanvasOperations();

const flowNodes = computed(() =>
  docStore.nodes.map((n) => ({
    id: String(n.id),
    type: "custom",
    position: { x: n.position.x, y: n.position.y },
    data: { node: n },
    selected: editorStore.selectedNodeIds.has(n.id),
  })),
);

const flowEdges = computed(() =>
  docStore.edges.map((e) => ({
    id: e.id,
    source: String(e.source.node),
    target: String(e.target.node),
    sourceHandle: e.source.port,
    targetHandle: e.target.port,
    selected: editorStore.selectedEdgeIds.has(e.id),
  })),
);

const onConnect = (connection: Connection): void => {
  if (
    connection.source === null ||
    connection.target === null ||
    connection.sourceHandle === null ||
    connection.targetHandle === null ||
    connection.sourceHandle === undefined ||
    connection.targetHandle === undefined
  ) {
    return;
  }
  ops.connect(
    { node: Number(connection.source), port: connection.sourceHandle },
    { node: Number(connection.target), port: connection.targetHandle },
  );
};

const onNodesChange = (changes: NodeChange[]): void => {
  for (const change of changes) {
    if (change.type === "position" && change.position && !change.dragging) {
      ops.moveNode(Number(change.id), { x: change.position.x, y: change.position.y });
    } else if (change.type === "remove") {
      ops.removeNode(Number(change.id));
    } else if (change.type === "select") {
      const id = Number(change.id);
      if (change.selected) editorStore.selectNode(id, true);
      else editorStore.clearSelection();
    }
  }
};

const onEdgesChange = (changes: EdgeChange[]): void => {
  for (const change of changes) {
    if (change.type === "remove") {
      ops.removeEdge(change.id);
    } else if (change.type === "select") {
      if (change.selected) editorStore.selectEdge(change.id, true);
      else editorStore.clearSelection();
    }
  }
};
</script>

<template>
  <div class="canvas-root" data-testid="canvas-root">
    <VueFlow
      :nodes="flowNodes"
      :edges="flowEdges"
      :default-viewport="{ x: 0, y: 0, zoom: 1 }"
      fit-view-on-init
      @connect="onConnect"
      @nodes-change="onNodesChange"
      @edges-change="onEdgesChange"
    >
      <template #node-custom="props">
        <CustomNode :data="props.data" />
      </template>
      <Background />
      <MiniMap />
      <Controls />
    </VueFlow>
  </div>
</template>

<style scoped>
.canvas-root {
  width: 100%;
  height: 100%;
}
</style>
