<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import {
  VueFlow,
  useVueFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type NodeMouseEvent,
} from "@vue-flow/core";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import { Background } from "@vue-flow/background";
import { Controls, ControlButton } from "@vue-flow/controls";
import { MiniMap } from "@vue-flow/minimap";
import { ZoomIn, ZoomOut, Maximize2, Lock, Unlock } from "lucide-vue-next";
import { useDocumentStore } from "../stores/documentStore";
import { useEditorStore } from "../stores/editorStore";
import { useCanvasOperations } from "../composables/useCanvasOperations";
import { SUBGRAPH_NODE_TYPE } from "../../document/subgraph";
import CustomNode from "./CustomNode.vue";
import CommentNode from "./CommentNode.vue";

const docStore = useDocumentStore();
const editorStore = useEditorStore();
const {
  fitView,
  zoomIn,
  zoomOut,
  setInteractive,
  nodesDraggable,
  nodesConnectable,
  elementsSelectable,
} = useVueFlow();

const isInteractive = computed(
  () => nodesDraggable.value || nodesConnectable.value || elementsSelectable.value,
);

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
  const nodes = docStore.currentLevelGraph.nodes.map((n) => ({
    id: String(n.id),
    type: "custom",
    position: { x: n.position.x, y: n.position.y },
    data: { node: n },
    selected: editorStore.selectedNodeIds.has(n.id),
  }));
  const commentNodes = docStore.currentLevelGraph.comments.map((c) => ({
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
  docStore.currentLevelGraph.edges.map((e) => ({
    id: e.id,
    source: String(e.source.node),
    target: String(e.target.node),
    sourceHandle: e.source.port,
    targetHandle: e.target.port,
    selected: editorStore.selectedEdgeIds.has(e.id),
  })),
);

const defaultViewport = computed(
  () => docStore.currentLevelGraph.viewport ?? { x: 0, y: 0, zoom: 1 },
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

const onNodeDoubleClick = ({ node }: NodeMouseEvent): void => {
  const inner = (node.data as { node?: { type: string } } | undefined)?.node;
  if (!inner) return;
  if (inner.type !== SUBGRAPH_NODE_TYPE) return;
  ops.enterSubgraph(Number(node.id));
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
      :default-viewport="defaultViewport"
      fit-view-on-init
      @connect="onConnect"
      @nodes-change="onNodesChange"
      @edges-change="onEdgesChange"
      @node-double-click="onNodeDoubleClick"
    >
      <template #node-custom="props">
        <CustomNode :data="props.data" />
      </template>
      <template #node-comment="props">
        <CommentNode :data="props.data" />
      </template>
      <Background />
      <MiniMap />
      <Controls>
        <template #control-zoom-in>
          <ControlButton aria-label="Zoom in" @click="zoomIn()">
            <ZoomIn />
          </ControlButton>
        </template>
        <template #control-zoom-out>
          <ControlButton aria-label="Zoom out" @click="zoomOut()">
            <ZoomOut />
          </ControlButton>
        </template>
        <template #control-fit-view>
          <ControlButton aria-label="Fit view" @click="fitView()">
            <Maximize2 />
          </ControlButton>
        </template>
        <template #control-interactive>
          <ControlButton
            aria-label="Toggle interaction mode"
            @click="setInteractive(!isInteractive)"
          >
            <Unlock v-if="isInteractive" />
            <Lock v-else />
          </ControlButton>
        </template>
      </Controls>
    </VueFlow>
  </div>
</template>

<style scoped>
.canvas-root {
  width: 100%;
  height: 100%;
}
</style>
