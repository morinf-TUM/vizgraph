// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import { useDocumentStore } from "../../../../src/editor/stores/documentStore";
import { useValidationStore } from "../../../../src/editor/stores/validationStore";
import { useLiveValidation } from "../../../../src/editor/composables/useLiveValidation";

const Host = defineComponent({
  setup() {
    useLiveValidation();
    return () => h("div");
  },
});

describe("useLiveValidation", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs validate() once on mount and writes the result to validationStore", () => {
    const docStore = useDocumentStore();
    docStore.replaceDocument({
      version: 1,
      graph: {
        nodes: [{ id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: {} }],
        edges: [],
        comments: [],
      },
    });
    const wrapper = mount(Host, {
      global: { plugins: [] },
    });
    const validationStore = useValidationStore();
    expect(validationStore.diagnostics.length).toBeGreaterThan(0);
    expect(validationStore.errors.some((d) => d.code === "missing_required_parameter")).toBe(true);
    wrapper.unmount();
  });

  it("debounces document mutations: validation only fires after 200 ms of quiet", async () => {
    const docStore = useDocumentStore();
    const wrapper = mount(Host);
    const validationStore = useValidationStore();
    expect(validationStore.diagnostics).toEqual([]);

    // Three rapid mutations within the debounce window: only one validation
    // should fire after the timer elapses.
    docStore.addNode({ type: "Mystery", position: { x: 0, y: 0 } });
    docStore.addNode({ type: "Mystery", position: { x: 0, y: 0 } });
    docStore.addNode({ type: "Mystery", position: { x: 0, y: 0 } });

    // Inside the debounce window: still empty (no validate call yet beyond
    // the initial mount-time run).
    await vi.advanceTimersByTimeAsync(100);
    expect(validationStore.diagnostics).toEqual([]);

    // After the debounce: validate runs and surfaces three unknown_node_type
    // diagnostics.
    await vi.advanceTimersByTimeAsync(200);
    expect(validationStore.errors.filter((d) => d.code === "unknown_node_type")).toHaveLength(3);

    wrapper.unmount();
  });
});
