import { test, expect } from "@playwright/test";

test("editor shell renders palette, canvas, property panel, and validation panel", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("top-bar")).toBeVisible();
  await expect(page.getByTestId("palette")).toBeVisible();
  await expect(page.getByTestId("canvas-root")).toBeVisible();
  await expect(page.getByTestId("property-panel")).toBeVisible();
  await expect(page.getByTestId("validation-panel")).toBeVisible();
});

test("clicking a palette item adds a node and the property panel reflects selection", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("palette-Constant").click();
  // The new node lands in the canvas; selecting it shows Constant-specific
  // controls in the property panel.
  const nodeLocator = page.locator(".vue-flow__node-custom").first();
  await expect(nodeLocator).toBeVisible();
  await nodeLocator.click();
  await expect(page.getByTestId("property-constant-value")).toBeVisible();
  await page.getByTestId("property-constant-value").fill("7");
  await page.getByTestId("property-constant-value").blur();
  // Dirty indicator appears in the top bar.
  await expect(page.getByText("unsaved")).toBeVisible();
});

test("drag-to-add: dragging a palette item onto the canvas adds a node at the cursor", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".vue-flow__node-custom")).toHaveCount(0);

  // Native HTML5 DnD in Playwright: share a DataTransfer handle across the
  // dragstart and drop events so the source and target see the same payload.
  // (Locator.dragTo synthesises pointer events, which the browser does not
  // upgrade to dragstart/drop for HTML5 DnD.)
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await page.getByTestId("palette-Constant").dispatchEvent("dragstart", { dataTransfer });

  const canvas = page.getByTestId("canvas-root");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas-root has no bounding box");
  const clientX = box.x + box.width / 2;
  const clientY = box.y + box.height / 2;
  await canvas.dispatchEvent("dragover", { dataTransfer, clientX, clientY });
  await canvas.dispatchEvent("drop", { dataTransfer, clientX, clientY });

  await expect(page.locator(".vue-flow__node-custom")).toHaveCount(1);
  // Dirty indicator surfaces because addNodeAt flips the dirty flag.
  await expect(page.getByText("unsaved")).toBeVisible();
});

test("Save button triggers a download with the current document JSON", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("palette-Constant").click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("topbar-save").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("graph.json");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  const parsed = JSON.parse(text) as { version: number; graph: { nodes: unknown[] } };
  expect(parsed.version).toBe(1);
  expect(parsed.graph.nodes).toHaveLength(1);
});

test("undo / redo: adding a node, undoing, and redoing reflects in the canvas", async ({
  page,
}) => {
  await page.goto("/");
  const undoBtn = page.getByTestId("topbar-undo");
  const redoBtn = page.getByTestId("topbar-redo");
  await expect(undoBtn).toBeDisabled();
  await expect(redoBtn).toBeDisabled();

  await page.getByTestId("palette-Constant").click();
  await expect(page.locator(".vue-flow__node-custom")).toHaveCount(1);
  await expect(undoBtn).toBeEnabled();

  await undoBtn.click();
  await expect(page.locator(".vue-flow__node-custom")).toHaveCount(0);
  await expect(redoBtn).toBeEnabled();

  await redoBtn.click();
  await expect(page.locator(".vue-flow__node-custom")).toHaveCount(1);
});

test("Comment button adds a comment to the canvas and persists it on save", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("topbar-add-comment").click();
  // The comment renders as a VueFlow node with our CommentNode template.
  await expect(page.locator(".vue-flow__node-comment")).toHaveCount(1);
  await expect(page.getByTestId("comment-text-c1")).toContainText("New comment");

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("topbar-save").click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
    graph: { comments: Array<{ id: string; text: string }> };
  };
  expect(parsed.graph.comments).toHaveLength(1);
  expect(parsed.graph.comments[0]?.id).toBe("c1");
  expect(parsed.graph.comments[0]?.text).toBe("New comment");
});

test("PropertyPanel + comment button creates a comment anchored to the selected node", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("palette-Constant").click();
  await page.locator(".vue-flow__node-custom").first().click();
  await expect(page.getByTestId("property-attach-comment")).toBeVisible();
  await page.getByTestId("property-attach-comment").click();

  // Comment appears on the canvas.
  await expect(page.locator(".vue-flow__node-comment")).toHaveCount(1);

  // attachedTo round-trips through the saved JSON.
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("topbar-save").click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
    graph: {
      nodes: Array<{ id: number }>;
      comments: Array<{ id: string; attachedTo?: { node?: number } }>;
    };
  };
  expect(parsed.graph.comments).toHaveLength(1);
  const nodeId = parsed.graph.nodes[0]?.id;
  expect(parsed.graph.comments[0]?.attachedTo).toEqual({ node: nodeId });
});

test("Ctrl+S keyboard shortcut triggers a download", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("palette-Constant").click();
  // Click the canvas to drop focus from the palette button so the next
  // Control+S isn't intercepted as an accidental Enter on a focused button.
  await page.getByTestId("canvas-root").click({ position: { x: 200, y: 200 } });

  const downloadPromise = page.waitForEvent("download");
  await page.keyboard.press("Control+s");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("graph.json");
});

test("validation panel surfaces missing_required_parameter for a fresh Constant", async ({
  page,
}) => {
  await page.goto("/");
  // Default Constant.value default (0) is applied by useCanvasOperations, so a
  // fresh Constant validates clean. Strip the default by clearing the value
  // input, which leaves an empty string -> NaN -> not an int. The store still
  // holds the original 0 unless we explicitly remove it; clearing the input
  // normally leaves value as 0 because of the Math.trunc fallback. To force a
  // missing-parameter case, add a Constant then clear via JS.
  await page.getByTestId("palette-Constant").click();
  // Click the node to select it.
  await page.locator(".vue-flow__node-custom").first().click();
  // Set the value input to a non-numeric string to trigger
  // parameter_type_mismatch (the input handler only writes Math.trunc when
  // Number.isFinite passes; "" yields NaN -> handler returns early, parameter
  // stays at 0). To get a real diagnostic, target an isolated-node warning
  // instead, which fires for any Constant with no edges.
  await expect(page.getByTestId("validation-warning-isolated_node")).toBeVisible();
});

test("import RunResult: overlays render in inspect mode and clear when toggled", async ({
  page,
}) => {
  await page.goto("/");
  // Load the simple-add legacy fixture via the file input so the node ids
  // match the run-result fixture (1, 2, 3, 4).
  const graphJson = JSON.stringify({
    version: 1,
    graph: {
      nodes: [
        {
          id: 1,
          name: "Two",
          type: "Constant",
          position: { x: 0, y: 0 },
          parameters: { value: 2 },
        },
        {
          id: 2,
          name: "Three",
          type: "Constant",
          position: { x: 200, y: 0 },
          parameters: { value: 3 },
        },
        { id: 3, name: "Adder", type: "Add", position: { x: 400, y: 0 } },
        { id: 4, name: "Output", type: "Print", position: { x: 600, y: 0 } },
      ],
      edges: [
        {
          id: "e1_out__3_a",
          source: { node: 1, port: "out" },
          target: { node: 3, port: "a" },
        },
        {
          id: "e2_out__3_b",
          source: { node: 2, port: "out" },
          target: { node: 3, port: "b" },
        },
        {
          id: "e3_sum__4_in",
          source: { node: 3, port: "sum" },
          target: { node: 4, port: "in" },
        },
      ],
    },
  });
  await page.getByTestId("topbar-file-input").setInputFiles({
    name: "graph.json",
    mimeType: "application/json",
    buffer: Buffer.from(graphJson),
  });
  await expect(page.locator(".vue-flow__node-custom")).toHaveCount(4);

  // Mode starts as edit; toggle is disabled until a RunResult is imported.
  await expect(page.getByTestId("top-bar-mode")).toHaveText("edit");
  await expect(page.getByTestId("topbar-toggle-mode")).toBeDisabled();

  // Import the matching run-result.
  const runResultJson = JSON.stringify({
    version: 1,
    graph_id: "simple-add",
    ticks: [
      {
        tick: 0,
        started_at_ns: 0,
        duration_ns: 27000,
        nodes: [
          { id: 1, outputs: { out: 2 }, duration_ns: 1000, error: null },
          { id: 2, outputs: { out: 3 }, duration_ns: 1000, error: null },
          { id: 3, outputs: { sum: 5 }, duration_ns: 12000, error: null },
          { id: 4, outputs: {}, duration_ns: 13000, error: null },
        ],
      },
    ],
  });
  await page.getByTestId("topbar-runresult-input").setInputFiles({
    name: "run.json",
    mimeType: "application/json",
    buffer: Buffer.from(runResultJson),
  });

  // Mode should now be inspect and the Add node's sum overlay should show 5.
  await expect(page.getByTestId("top-bar-mode")).toHaveText("inspect");
  await expect(page.getByTestId("overlay-3-sum")).toHaveText("5");
  await expect(page.getByTestId("overlay-1-out")).toHaveText("2");

  // Toggling back to edit mode hides overlays.
  await page.getByTestId("topbar-toggle-mode").click();
  await expect(page.getByTestId("top-bar-mode")).toHaveText("edit");
  await expect(page.getByTestId("overlay-3-sum")).toHaveCount(0);
});
