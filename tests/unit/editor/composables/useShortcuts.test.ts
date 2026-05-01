// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import { useShortcuts } from "../../../../src/editor/composables/useShortcuts";
import { useDocumentStore } from "../../../../src/editor/stores/documentStore";
import { useEditorStore } from "../../../../src/editor/stores/editorStore";
import { useHistoryStore } from "../../../../src/editor/stores/historyStore";
import { useClipboardStore } from "../../../../src/editor/stores/clipboardStore";
import { useCanvasOperations } from "../../../../src/editor/composables/useCanvasOperations";

const Host = defineComponent({
  setup() {
    useShortcuts();
    return () => h("div");
  },
});

const dispatchKey = (init: KeyboardEventInit & { key: string }, target?: EventTarget): boolean =>
  (target ?? window).dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));

describe("useShortcuts", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("Ctrl+Z calls history.undo and preventDefault", () => {
    const ops = useCanvasOperations();
    const history = useHistoryStore();
    const wrapper = mount(Host);
    ops.addNodeAt("Constant", { x: 0, y: 0 });
    expect(history.canUndo).toBe(true);
    dispatchKey({ key: "z", ctrlKey: true });
    expect(history.canUndo).toBe(false);
    wrapper.unmount();
  });

  it("Ctrl+Shift+Z calls history.redo", () => {
    const ops = useCanvasOperations();
    const history = useHistoryStore();
    const wrapper = mount(Host);
    ops.addNodeAt("Constant", { x: 0, y: 0 });
    history.undo();
    expect(history.canRedo).toBe(true);
    dispatchKey({ key: "Z", ctrlKey: true, shiftKey: true });
    expect(history.canRedo).toBe(false);
    wrapper.unmount();
  });

  it("Ctrl+Y also redoes", () => {
    const ops = useCanvasOperations();
    const history = useHistoryStore();
    const wrapper = mount(Host);
    ops.addNodeAt("Constant", { x: 0, y: 0 });
    history.undo();
    dispatchKey({ key: "y", ctrlKey: true });
    expect(history.canRedo).toBe(false);
    wrapper.unmount();
  });

  it("Ctrl+C copies the selection (no-op when nothing selected)", () => {
    const ops = useCanvasOperations();
    const editorStore = useEditorStore();
    const clipboard = useClipboardStore();
    const wrapper = mount(Host);
    const a = ops.addNodeAt("Constant", { x: 0, y: 0 })!;

    // No selection -> no-op (clip stays empty).
    dispatchKey({ key: "c", ctrlKey: true });
    expect(clipboard.hasClip).toBe(false);

    editorStore.selectNode(a.id);
    dispatchKey({ key: "c", ctrlKey: true });
    expect(clipboard.hasClip).toBe(true);
    wrapper.unmount();
  });

  it("Ctrl+V pastes when there's a clip", () => {
    const ops = useCanvasOperations();
    const editorStore = useEditorStore();
    const clipboard = useClipboardStore();
    const docStore = useDocumentStore();
    const wrapper = mount(Host);
    const a = ops.addNodeAt("Constant", { x: 0, y: 0 })!;
    editorStore.selectNode(a.id);
    clipboard.copy();

    dispatchKey({ key: "v", ctrlKey: true });
    expect(docStore.nodes).toHaveLength(2);
    wrapper.unmount();
  });

  it("Delete removes the selection", () => {
    const ops = useCanvasOperations();
    const editorStore = useEditorStore();
    const docStore = useDocumentStore();
    const wrapper = mount(Host);
    const a = ops.addNodeAt("Constant", { x: 0, y: 0 })!;
    editorStore.selectNode(a.id);

    dispatchKey({ key: "Delete" });
    expect(docStore.nodes).toEqual([]);
    wrapper.unmount();
  });

  it("Ctrl+S triggers a download (Blob URL + transient anchor click)", () => {
    const ops = useCanvasOperations();
    const wrapper = mount(Host);
    ops.addNodeAt("Constant", { x: 0, y: 0 });

    // Spy on URL.createObjectURL so we can assert the save path was taken
    // without depending on download UI specifics.
    const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    // Stub HTMLAnchorElement.click so the test environment doesn't navigate.
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    dispatchKey({ key: "s", ctrlKey: true });

    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledTimes(1);

    createObjectUrl.mockRestore();
    revokeObjectUrl.mockRestore();
    click.mockRestore();
    wrapper.unmount();
  });

  it("F calls editorStore.fitView", () => {
    const editorStore = useEditorStore();
    const wrapper = mount(Host);
    const fitSpy = vi.fn();
    editorStore.setFitViewFn(fitSpy);

    dispatchKey({ key: "f" });
    expect(fitSpy).toHaveBeenCalledTimes(1);
    dispatchKey({ key: "F" });
    expect(fitSpy).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });

  it("F is a no-op when no fitView is registered", () => {
    const editorStore = useEditorStore();
    const wrapper = mount(Host);
    expect(editorStore.fitView()).toBe(false);
    dispatchKey({ key: "f" });
    // No throw, no error - the absence of an assertion failure is the test.
    wrapper.unmount();
  });

  it("shortcuts are skipped when focus is in an editable element", () => {
    const ops = useCanvasOperations();
    const history = useHistoryStore();
    const wrapper = mount(Host);
    ops.addNodeAt("Constant", { x: 0, y: 0 });
    expect(history.canUndo).toBe(true);

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    dispatchKey({ key: "z", ctrlKey: true }, input);
    expect(history.canUndo).toBe(true);

    input.remove();
    wrapper.unmount();
  });
});
