import { test, expect } from "@playwright/test";

test("editor shell renders palette, canvas, and property panel", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("top-bar")).toBeVisible();
  await expect(page.getByTestId("palette")).toBeVisible();
  await expect(page.getByTestId("canvas-root")).toBeVisible();
  await expect(page.getByTestId("property-panel")).toBeVisible();
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
