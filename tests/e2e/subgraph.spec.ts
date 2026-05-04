import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execSync } from "node:child_process";
import path from "node:path";
import { promises as fs } from "node:fs";

test("group selection -> drill in -> rename pseudo-port -> save -> compile via CLI -> reload", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByTestId("top-bar")).toBeVisible();

  // Phase 1 — Load 4-node Const+Const+Add+Print graph.
  const initial = JSON.stringify({
    version: 1,
    graph: {
      nodes: [
        { id: 1, type: "Constant", position: { x: 60, y: 60 }, parameters: { value: 0 } },
        { id: 2, type: "Constant", position: { x: 60, y: 200 }, parameters: { value: 0 } },
        { id: 3, type: "Add", position: { x: 280, y: 130 }, parameters: {} },
        { id: 4, type: "Print", position: { x: 500, y: 130 }, parameters: {} },
      ],
      edges: [
        { id: "e1_out__3_a", source: { node: 1, port: "out" }, target: { node: 3, port: "a" } },
        { id: "e2_out__3_b", source: { node: 2, port: "out" }, target: { node: 3, port: "b" } },
        { id: "e3_sum__4_in", source: { node: 3, port: "sum" }, target: { node: 4, port: "in" } },
      ],
      comments: [],
    },
  });
  await page.getByTestId("topbar-file-input").setInputFiles({
    name: "initial.json",
    mimeType: "application/json",
    buffer: Buffer.from(initial),
  });
  await expect(page.locator(".vue-flow__node-custom")).toHaveCount(4);

  // Phase 2 — Select only the Add node (VueFlow multiSelectionKeyCode is Ctrl, not Shift).
  // Grouping Add alone produces 2 SubgraphInputs (one per Constant feeder) and 1 SubgraphOutput.
  // Grouping all three would produce 0 SubgraphInputs (the Constant→Add edges become internal).
  await page.locator('.vue-flow__node-custom:has([data-node-type="Add"])').click();
  await expect(page.getByTestId("topbar-group")).toBeEnabled();

  // Phase 3 — Group; assert Subgraph + Print + 2 Constants at root, no Add at root.
  await page.getByTestId("topbar-group").click();
  await expect(page.locator('[data-node-type="Subgraph"]')).toHaveCount(1);
  await expect(page.locator('[data-node-type="Print"]')).toHaveCount(1);
  // The two Constant nodes remain at root level (they were not selected for grouping).
  await expect(page.locator('[data-node-type="Constant"]')).toHaveCount(2);
  await expect(page.locator('[data-node-type="Add"]')).toHaveCount(0);

  // Phase 4 — Drill in via dblclick; assert pseudo-nodes visible; axe gate.
  await page.locator('.vue-flow__node-custom:has([data-node-type="Subgraph"])').dblclick();
  // Fit view so inner nodes are centered and not hidden behind the palette sidebar.
  await page.getByRole("button", { name: "Fit view" }).click();
  await expect(page.locator('[data-node-type="SubgraphInput"]').first()).toBeVisible();
  await expect(page.locator('[data-node-type="SubgraphOutput"]').first()).toBeVisible();
  // (Two SubgraphInputs are expected — one per Constant feeder; one SubgraphOutput from Add.sum.)
  await expect(page.locator('[data-node-type="SubgraphInput"]')).toHaveCount(2);
  await expect(page.locator('[data-node-type="SubgraphOutput"]')).toHaveCount(1);

  // axe gate at depth 1.
  const axe = await new AxeBuilder({ page }).analyze();
  const blocking = axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
  expect(blocking).toEqual([]);

  // Phase 5 — Click first SubgraphInput; rename via PropertyPanel.
  await page
    .locator('.vue-flow__node-custom:has([data-node-type="SubgraphInput"])')
    .first()
    .click();
  // Wait for PropertyPanel to render the pseudo input (selectedNode.size === 1 path).
  await expect(page.getByTestId("property-pseudo-name")).toBeVisible();
  await page.getByTestId("property-pseudo-name").fill("alpha");
  // Blur after fill so the @input handler's renamePseudoPort commit reaches the
  // store and Vue re-renders the :value binding from the store, not just from
  // the literal value Playwright typed. Without this, toHaveValue could pass on
  // the typed-but-not-yet-overridden DOM value and never exercise the handler.
  await page.getByTestId("property-pseudo-name").blur();
  await expect(page.getByTestId("property-pseudo-name")).toHaveValue("alpha");

  // Phase 6 — Drill out via Breadcrumbs Root.
  await page.getByRole("button", { name: /^root$/i }).click();
  await expect(page.locator('[data-node-type="Subgraph"]')).toHaveCount(1);

  // Phase 7 — Save -> capture download.
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("topbar-save").click();
  const download = await downloadPromise;
  const tmpDir = testInfo.outputPath();
  await fs.mkdir(tmpDir, { recursive: true });
  const savedPath = path.join(tmpDir, "saved.json");
  await download.saveAs(savedPath);

  // Phase 8 — Parse saved JSON; assert pseudo-rename round-tripped to inner-graph parameters.name.
  const savedRaw = await fs.readFile(savedPath, "utf-8");
  const saved = JSON.parse(savedRaw) as {
    version: number;
    graph: {
      nodes: {
        id: number;
        type: string;
        parameters?: {
          children?: { graph: { nodes: { type: string; parameters?: Record<string, unknown> }[] } };
        };
      }[];
    };
  };
  expect(saved.graph.nodes.find((n) => n.type === "Subgraph")).toBeTruthy();
  const subgraphNode = saved.graph.nodes.find((n) => n.type === "Subgraph");
  expect(subgraphNode).toBeDefined();
  const innerNodes = subgraphNode!.parameters!.children!.graph.nodes;
  const renamed = innerNodes.find(
    (n) => n.type === "SubgraphInput" && (n.parameters as { name?: string }).name === "alpha",
  );
  expect(renamed).toBeDefined();

  // Phase 9 — Compile via CLI; assert flattened shape.
  const out = execSync(`node bin/vizgraph.mjs compile ${savedPath}`, {
    cwd: process.cwd(),
  }).toString();
  const compiled = JSON.parse(out) as { nodes: { type: string }[]; edges: unknown[] };
  expect(compiled.nodes.map((n) => n.type).sort()).toEqual([
    "Add",
    "Constant",
    "Constant",
    "Print",
  ]);
  expect(compiled.edges).toHaveLength(3);

  // Phase 10 — Reload from disk; assert root has Subgraph + Print + 2 Constants.
  await page.getByTestId("topbar-file-input").setInputFiles(savedPath);
  await expect(page.locator('[data-node-type="Subgraph"]')).toHaveCount(1);
  await expect(page.locator('[data-node-type="Print"]')).toHaveCount(1);
  await expect(page.locator('[data-node-type="Constant"]')).toHaveCount(2);
});
