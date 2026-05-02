<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import {
  VueFlow,
  useVueFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@vue-flow/core";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import { MiniMap } from "@vue-flow/minimap";
import { useDocumentStore } from "../stores/documentStore";
import { useEditorStore } from "../stores/editorStore";
import { useCanvasOperations } from "../composables/useCanvasOperations";
import CustomNode from "./CustomNode.vue";
import CommentNode from "./CommentNode.vue";

const docStore = useDocumentStore();
const editorStore = useEditorStore();
const { fitView } = useVueFlow();

// Expose VueFlow's fitView to the global keyboard shortcut layer (the F key)
// without forcing useShortcuts to be a descendant of the canvas. The store
// reference is cleared on unmount so dispatching to a stale instance after
// the canvas tears down is impossible.
onMounted(() => {
  editorStore.setFitViewFn(() => {
    // VueFlow's fitView returns a promise (it animates); we don't await it
    // because the keyboard shortcut layer is fire-and-forget.
    void fitView();
  });

  // Add aria-labels to VueFlow Controls buttons for a11y.
  // These buttons are rendered by @vue-flow/controls and have no accessible names.
  const controls = document.querySelector(".vue-flow__controls");
  if (controls) {
    const zoomInBtn = controls.querySelector(".vue-flow__controls-zoomin");
    const zoomOutBtn = controls.querySelector(".vue-flow__controls-zoomout");
    const fitViewBtn = controls.querySelector(".vue-flow__controls-fitview");
    const interactiveBtn = controls.querySelector(".vue-flow__controls-interactive");

    if (zoomInBtn && !zoomInBtn.getAttribute("aria-label")) {
      zoomInBtn.setAttribute("aria-label", "Zoom in");
    }
    if (zoomOutBtn && !zoomOutBtn.getAttribute("aria-label")) {
      zoomOutBtn.setAttribute("aria-label", "Zoom out");
    }
    if (fitViewBtn && !fitViewBtn.getAttribute("aria-label")) {
      fitViewBtn.setAttribute("aria-label", "Fit view to selection");
    }
    if (interactiveBtn && !interactiveBtn.getAttribute("aria-label")) {
      interactiveBtn.setAttribute("aria-label", "Toggle interaction mode");
    }
  }
});
onUnmounted(() => {
  editorStore.setFitViewFn(undefined);
});
const ops = useCanvasOperations();

// Node ids in our document are integers, comment ids are strings prefixed
// with "c". To avoid collisions in VueFlow's flat id namespace, comments
// surface to VueFlow with a "c:" prefix the change handlers strip back off.
const COMMENT_PREFIX = "c:";

const flowNodes = computed(() => {
  const nodes = docStore.nodes.map((n) => ({
    id: String(n.id),
    type: "custom",
    position: { x: n.position.x, y: n.position.y },
    data: { node: n },
    selected: editorStore.selectedNodeIds.has(n.id),
  }));
  const commentNodes = docStore.comments.map((c) => ({
    id: COMMENT_PREFIX + c.id,
    type: "comment",
    position: { x: c.position.x, y: c.position.y },
    data: { comment: c },
    draggable: true,
    selectable: true,
  }));
  return [...nodes, ...commentNodes];
});

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
    // VueFlow's NodeAddChange variant has no top-level id; skip it (we
    // create nodes through useCanvasOperations, not through VueFlow's add
    // events). All remaining change types in the union expose .id.
    if (change.type === "add") continue;
    const id = change.id;
    const isComment = typeof id === "string" && id.startsWith(COMMENT_PREFIX);
    const commentId = isComment ? id.slice(COMMENT_PREFIX.length) : undefined;
    if (change.type === "position" && change.position && !change.dragging) {
      if (commentId !== undefined) {
        ops.moveComment(commentId, { x: change.position.x, y: change.position.y });
      } else {
        ops.moveNode(Number(id), { x: change.position.x, y: change.position.y });
      }
    } else if (change.type === "remove") {
      if (commentId !== undefined) ops.removeComment(commentId);
      else ops.removeNode(Number(id));
    } else if (change.type === "select") {
      // Comments don't participate in editor-store selection (they have no
      // property panel); we rely on VueFlow's internal selected flag for
      // visuals. Skip the store update for comment selection events.
      if (isComment) continue;
      const numericId = Number(id);
      if (change.selected) editorStore.selectNode(numericId, true);
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
      <template #node-comment="props">
        <CommentNode :data="props.data" />
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
