import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("editor has no serious or critical accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("canvas-root")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const blocking = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );

  if (blocking.length > 0) {
    // Surface details so failures are diagnosable in CI logs.
    console.error(JSON.stringify(blocking, null, 2));
  }
  expect(blocking).toEqual([]);
});
