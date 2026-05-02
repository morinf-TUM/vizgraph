# Dark Theme + a11y Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current ad-hoc light styling with a single n8n-style dark theme, defined as CSS custom properties in a primitive+semantic two-layer structure, and add a Playwright/axe-driven accessibility regression gate.

**Architecture:** New file `src/styles/theme.css` defines `--vg-color-*` (primitives) and `--vg-*` (semantics) custom properties, scoped under both `:root` (always-on) and `[data-theme="dark"]` (future-proofing for additional themes). Components consume only semantic tokens. A new e2e spec runs `@axe-core/playwright` against the editor and asserts zero `serious`/`critical` violations.

**Tech Stack:** Vue 3 (existing), Vite (existing), Playwright (existing), `@axe-core/playwright` (new devDep).

**Spec:** `docs/specs/2026-05-02-dark-theme-design.md`.

**Test strategy notes:** Pure CSS recolor — there's no red-green TDD cycle for "the color is now dark." The axe e2e test is the regression gate; it's written first (Task 2) and is expected to pass against the current light theme. After each sweep task we re-run the existing Vitest + Playwright suites to ensure no logic regressed. Manual smoke pass with `pnpm dev` after the full sweep validates visual correctness.

**Branch:** `feat/dark-theme` (already created; spec already committed at `aabb00c`).

---

## Files Touched

**Created:**
- `src/styles/theme.css` — primitive + semantic token definitions
- `docs/theming.md` — semantic-token contract for contributors
- `tests/e2e/a11y.spec.ts` — axe regression gate

**Modified:**
- `package.json` — add `@axe-core/playwright` devDep
- `pnpm-lock.yaml` — lockfile update from install
- `src/main.ts` — import `./styles/theme.css`
- `index.html` — add `data-theme="dark"` to `<html>`
- `src/App.vue` — sweep colors → semantic tokens
- `src/editor/components/TopBar.vue` — sweep
- `src/editor/components/Palette.vue` — sweep
- `src/editor/components/PropertyPanel.vue` — sweep
- `src/editor/components/ValidationPanel.vue` — sweep
- `src/editor/components/CanvasView.vue` — sweep
- `src/editor/components/CustomNode.vue` — sweep
- `src/editor/components/CommentNode.vue` — sweep
- `PROJECT_MEMORY.md` — record dark-only decision; remove `useTheme` mention
- `CHANGELOG.md` — add entry under appropriate section

---

## Color → Token Mapping (Reference)

Use this table for every sweep task. Only ambiguous cases are explained inline within each task.

| Old hex / role                                                    | New semantic token        |
|-------------------------------------------------------------------|---------------------------|
| `#fafafa` (page bg)                                               | `--vg-bg`                 |
| `#fff` / `white` (panel/card bg)                                  | `--vg-surface`            |
| `#f1f5f9`, `#f6f8fa` (raised, header bg)                          | `--vg-surface-2`          |
| `#f3f4f6` (hover bg)                                              | `--vg-surface-hover`      |
| `#d0d7de`, `#e5e7eb`, `#eaecef`, `#eee` (default border)          | `--vg-border`             |
| (any "stronger" border)                                           | `--vg-border-strong`      |
| `#111827` (primary text)                                          | `--vg-text`               |
| `#374151` (primary text alt)                                      | `--vg-text`               |
| `#6b7280` (muted)                                                 | `--vg-text-muted`         |
| `#9ca3af` (subtle)                                                | `--vg-text-subtle`        |
| `#2563eb` (selected/link/border accent)                           | `--vg-accent`             |
| `#1e40af` (selected text)                                         | `--vg-accent` (hover variant if needed) |
| `#dbeafe` (selected pill bg)                                      | `--vg-accent-bg`          |
| `#d97706`, `#b45309` (warning text/border)                        | `--vg-warn`               |
| `#fff7ed`, `#fffbeb` (warning bg)                                 | `--vg-warn-bg`            |
| `#f59e0b` (warning border alt)                                    | `--vg-warn`               |
| `#78350f` (warning text alt)                                      | `--vg-warn`               |
| `#b91c1c`, `#ef4444` (error text/bg)                              | `--vg-error`              |
| `#fef2f2` (error bg)                                              | `--vg-error-bg`           |
| `box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04)` / `0.05`              | `box-shadow: var(--vg-shadow-sm)` |

Element Plus fallbacks (`var(--el-*-, #fallback)`) keep their `--el-*` reference; only the fallback hex is updated to a dark equivalent.

---

## Task 1: Install `@axe-core/playwright`

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Install as a devDep**

```bash
. ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm add -D @axe-core/playwright
```

Expected: pnpm reports the package added to `devDependencies`, `pnpm-lock.yaml` updated.

- [ ] **Step 2: Verify install**

```bash
. ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm ls @axe-core/playwright
```

Expected: a single resolved version line.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build: add @axe-core/playwright devDep for a11y regression gate"
```

---

## Task 2: Add baseline a11y e2e test

**Files:**
- Create: `tests/e2e/a11y.spec.ts`

- [ ] **Step 1: Write the test**

```ts
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
```

- [ ] **Step 2: Run e2e and confirm the new spec passes against the current light theme**

```bash
. ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm e2e
```

Expected: all 7 tests pass (6 existing + 1 new a11y). If the new test fails on the current light theme, the failure represents a pre-existing a11y bug — fix it before continuing (palette items, palette search input, etc. need accessible names / labels).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/a11y.spec.ts
git commit -m "test(e2e): add axe a11y regression gate"
```

---

## Task 3: Create `src/styles/theme.css` with two-layer tokens

**Files:**
- Create: `src/styles/theme.css`

- [ ] **Step 1: Write the file**

```css
/* Theme tokens — primitive + semantic two-layer structure.
 *
 * Components MUST consume semantic tokens only (e.g. var(--vg-bg)).
 * Reaching for a primitive (var(--vg-color-coral-500)) from a component
 * is a smell — it means the component has its own intent that wants its
 * own semantic token.
 *
 * Adding a future theme: drop a sibling block, e.g.
 *   [data-theme="light"] { --vg-bg: var(--vg-color-slate-50); ... }
 * No component changes required.
 */

:root {
  /* ── Primitive layer — raw palette ── */
  --vg-color-slate-950: #1a1d23;
  --vg-color-slate-900: #23272e;
  --vg-color-slate-800: #2c313a;
  --vg-color-slate-750: #323843;
  --vg-color-slate-700: #3a3f47;
  --vg-color-slate-600: #4a505a;
  --vg-color-slate-400: #6b7280;
  --vg-color-slate-300: #9aa1ad;
  --vg-color-slate-100: #e6e8eb;

  --vg-color-coral-500: #ff6d5a;
  --vg-color-coral-400: #ff8676;
  --vg-color-coral-950: #3a2522;

  --vg-color-amber-500: #f5a623;
  --vg-color-amber-950: #3a2c14;

  --vg-color-red-500: #ff5c5c;
  --vg-color-red-950: #3a1f1f;

  --vg-color-blue-400: #6ab0ff;
  --vg-color-blue-950: #1c2a3a;
}

[data-theme="dark"], :root {
  /* ── Semantic layer — what components consume ── */

  /* Surfaces */
  --vg-bg: var(--vg-color-slate-950);
  --vg-surface: var(--vg-color-slate-900);
  --vg-surface-2: var(--vg-color-slate-800);
  --vg-surface-hover: var(--vg-color-slate-750);

  /* Borders */
  --vg-border: var(--vg-color-slate-700);
  --vg-border-strong: var(--vg-color-slate-600);

  /* Text */
  --vg-text: var(--vg-color-slate-100);
  --vg-text-muted: var(--vg-color-slate-300);
  --vg-text-subtle: var(--vg-color-slate-400);
  --vg-text-on-accent: var(--vg-color-slate-950);

  /* Accent */
  --vg-accent: var(--vg-color-coral-500);
  --vg-accent-hover: var(--vg-color-coral-400);
  --vg-accent-bg: var(--vg-color-coral-950);

  /* Status */
  --vg-warn: var(--vg-color-amber-500);
  --vg-warn-bg: var(--vg-color-amber-950);
  --vg-error: var(--vg-color-red-500);
  --vg-error-bg: var(--vg-color-red-950);
  --vg-info: var(--vg-color-blue-400);
  --vg-info-bg: var(--vg-color-blue-950);

  /* Effects */
  --vg-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.35);
  --vg-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.45);
  --vg-focus-ring: 0 0 0 2px var(--vg-accent);
}
```

- [ ] **Step 2: Type-check (sanity, will pass — no TS impact)**

```bash
. ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm typecheck
```

Expected: exit 0. (CSS files are not in the TS project; this just confirms nothing else broke.)

- [ ] **Step 3: Commit**

```bash
git add src/styles/theme.css
git commit -m "feat(theme): add primitive+semantic CSS token foundation"
```

---

## Task 4: Wire `theme.css` import + `data-theme` attribute

**Files:**
- Modify: `src/main.ts`
- Modify: `index.html`

- [ ] **Step 1: Add import to `src/main.ts`**

Replace the file with:

```ts
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import "./styles/theme.css";

// Element Plus is part of the locked stack (PROJECT_MEMORY) but no component
// or directive in the editor uses it yet, so the global registration and
// theme CSS were eager-loading ~700KB of unused weight. Components that need
// Element Plus can import per-component (e.g. `import { ElButton } from
// "element-plus"`) when the time comes.
const app = createApp(App);
app.use(createPinia());
app.mount("#app");
```

- [ ] **Step 2: Add `data-theme="dark"` to `index.html`**

Edit `index.html` line 2: change `<html lang="en">` to `<html lang="en" data-theme="dark">`.

Final file:

```html
<!doctype html>
<html lang="en" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>n8n-port editor</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 3: Boot the dev server and verify the page paints**

```bash
. ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm dev
```

Expected: dev server boots; opening `http://localhost:5173` shows the editor with the existing light styling unchanged (tokens are defined but no component consumes them yet). Stop the server (Ctrl-C).

- [ ] **Step 4: Run all gates**

```bash
. ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm test && pnpm lint && pnpm typecheck && pnpm format:check && pnpm build && pnpm e2e
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts index.html
git commit -m "feat(theme): import theme.css and tag <html> with data-theme"
```

---

## Task 5: Write `docs/theming.md`

**Files:**
- Create: `docs/theming.md`

- [ ] **Step 1: Write the file**

```markdown
# Theming

This project uses a single dark theme defined in `src/styles/theme.css`. Tokens are split into a **primitive layer** (raw palette, never consumed by components) and a **semantic layer** (what components read).

## Component contract

Components MUST read only semantic tokens (`var(--vg-bg)`, `var(--vg-accent)`, …). Reaching for a primitive (`var(--vg-color-coral-500)`) from a component is a smell — it means the component has an unmodelled intent. Add a new semantic token instead of bypassing the layer.

## Adding a new theme later

1. Add a sibling block to `theme.css`:
   ```css
   [data-theme="light"] {
     --vg-bg: var(--vg-color-slate-50);
     /* … remap every semantic token … */
   }
   ```
2. Toggle by setting `data-theme="light"` on `<html>` (e.g. via a `useTheme` composable, system-preference media query, or persisted user choice).
3. No component changes are required.

## Semantic tokens

### Surfaces
| Token | Use |
|---|---|
| `--vg-bg` | App-level page background. The big canvas-area fill. |
| `--vg-surface` | Panel / card / modal background. Default "elevated" surface. |
| `--vg-surface-2` | Raised within a panel — e.g. inset wells, header strips, code blocks. NOT for selection. |
| `--vg-surface-hover` | Hover background for buttons / list items. |

### Borders
| Token | Use |
|---|---|
| `--vg-border` | Default 1px border between panels, inputs, cards. |
| `--vg-border-strong` | Hover/focus border, or any border that needs to read as more present. |

### Text
| Token | Use |
|---|---|
| `--vg-text` | Primary body text and headings. |
| `--vg-text-muted` | Secondary text — captions, timestamps, helper copy. |
| `--vg-text-subtle` | Tertiary text — placeholders, disabled labels. |
| `--vg-text-on-accent` | Foreground when the background is `--vg-accent` (e.g. primary button text). |

### Accent (n8n coral)
| Token | Use |
|---|---|
| `--vg-accent` | Selected state, primary buttons, active nav, links. |
| `--vg-accent-hover` | Hover variant of `--vg-accent`. |
| `--vg-accent-bg` | Tinted background for selected pills, active chips, accent callouts. |

### Status
| Token | Use |
|---|---|
| `--vg-warn` / `--vg-warn-bg` | Warnings, dirty/unsaved state, soft errors. |
| `--vg-error` / `--vg-error-bg` | Validation errors, destructive actions. |
| `--vg-info` / `--vg-info-bg` | Informational notes. Used sparingly. |

### Effects
| Token | Use |
|---|---|
| `--vg-shadow-sm` | Default card / button shadow. |
| `--vg-shadow-md` | Modals, popovers, dragged elements. |
| `--vg-focus-ring` | `box-shadow` for `:focus-visible` outlines on interactive elements. |
```

- [ ] **Step 2: Commit**

```bash
git add docs/theming.md
git commit -m "docs(theming): add semantic-token contract"
```

---

## Task 6: Sweep `src/App.vue`

**Files:**
- Modify: `src/App.vue`

Targets in the `<style scoped>` and `<style>` blocks:

| Line | Old | New |
|---|---|---|
| 59 | `var(--el-border-color-light, #eee)` | `var(--el-border-color-light, var(--vg-border))` |
| 65 | `var(--el-border-color-light, #eee)` | `var(--el-border-color-light, var(--vg-border))` |
| 75 | `var(--el-bg-color-page, #fafafa)` | `var(--el-bg-color-page, var(--vg-bg))` |
| 86 | `color: #6b7280;` | `color: var(--vg-text-muted);` |

- [ ] **Step 1: Apply the four edits**

- [ ] **Step 2: Run all gates**

```bash
. ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm test && pnpm lint && pnpm typecheck && pnpm format:check && pnpm build && pnpm e2e
```

Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add src/App.vue
git commit -m "style(theme): sweep App.vue to semantic tokens"
```

---

## Task 7: Sweep `src/editor/components/TopBar.vue`

**Files:**
- Modify: `src/editor/components/TopBar.vue`

The largest component (273 lines). Apply the global mapping table to every hex literal in the `<style scoped>` block. Notable mappings (from the line scan):

| Pattern | Replacement |
|---|---|
| `border-bottom: 1px solid #e5e7eb;` | `border-bottom: 1px solid var(--vg-border);` |
| `color: #b45309;` (dirty indicator) | `color: var(--vg-warn);` |
| `border-color: #d0d7de;` (default chip) | `border-color: var(--vg-border);` |
| `color: #6b7280;` (muted) | `color: var(--vg-text-muted);` |
| `background: #fff;` | `background: var(--vg-surface);` |
| `border-color: #2563eb;` (selected) | `border-color: var(--vg-accent);` |
| `color: #1e40af;` (selected text) | `color: var(--vg-accent);` |
| `background: #dbeafe;` (selected bg) | `background: var(--vg-accent-bg);` |
| `background: #d0d7de;` (separator) | `background: var(--vg-border);` |
| `color: #9ca3af;` | `color: var(--vg-text-subtle);` |
| `background: #f1f5f9;` (raised) | `background: var(--vg-surface-2);` |
| `color: #b91c1c;` (error) | `color: var(--vg-error);` |

- [ ] **Step 1: Apply the sweep**

Open `src/editor/components/TopBar.vue` and walk the `<style>` blocks top-to-bottom, replacing each color/border literal per the mapping table. After: zero hex literals remain in the file.

- [ ] **Step 2: Verify no hex literals remain**

```bash
grep -n "#[0-9a-fA-F]\{3,6\}" src/editor/components/TopBar.vue
```

Expected: empty output.

- [ ] **Step 3: Run all gates**

```bash
. ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm test && pnpm lint && pnpm typecheck && pnpm format:check && pnpm build && pnpm e2e
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/editor/components/TopBar.vue
git commit -m "style(theme): sweep TopBar.vue to semantic tokens"
```

---

## Task 8: Sweep `src/editor/components/Palette.vue`

**Files:**
- Modify: `src/editor/components/Palette.vue`

Style block (lines 73–113). Mappings:

| Old | New |
|---|---|
| `color: #374151;` (title) | `color: var(--vg-text);` |
| `border: 1px solid #d0d7de;` (search input) | `border: 1px solid var(--vg-border);` |
| `color: #6b7280;` (empty / category) | `color: var(--vg-text-muted);` |
| `border: 1px solid #d0d7de;` (item) | `border: 1px solid var(--vg-border);` |
| `background: #fff;` (item) | `background: var(--vg-surface);` |
| `background: #f1f5f9;` (item:hover) | `background: var(--vg-surface-hover);` |
| `border-color: #2563eb;` (item:hover) | `border-color: var(--vg-accent);` |

The `palette__title` color was `#374151`, the `palette__category` color was `#6b7280`. They both map per the table — `--vg-text` and `--vg-text-muted` respectively.

- [ ] **Step 1: Apply the sweep**

- [ ] **Step 2: Verify no hex literals remain**

```bash
grep -n "#[0-9a-fA-F]\{3,6\}" src/editor/components/Palette.vue
```

Expected: empty output.

- [ ] **Step 3: Run all gates**

```bash
. ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm test && pnpm lint && pnpm typecheck && pnpm format:check && pnpm build && pnpm e2e
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/editor/components/Palette.vue
git commit -m "style(theme): sweep Palette.vue to semantic tokens"
```

---

## Task 9: Sweep `src/editor/components/PropertyPanel.vue`

**Files:**
- Modify: `src/editor/components/PropertyPanel.vue`

Apply the global mapping table to every hex literal in `<style scoped>`. The notable patterns (from scan: `#374151`, `#6b7280`, `#b91c1c`, `#111827`, `#d0d7de`):

| Old | New |
|---|---|
| `color: #374151;` | `color: var(--vg-text);` |
| `color: #6b7280;` | `color: var(--vg-text-muted);` |
| `color: #b91c1c;` | `color: var(--vg-error);` |
| `color: #111827;` | `color: var(--vg-text);` |
| `border: 1px solid #d0d7de;` | `border: 1px solid var(--vg-border);` |

- [ ] **Step 1: Apply the sweep**

- [ ] **Step 2: Verify no hex literals remain**

```bash
grep -n "#[0-9a-fA-F]\{3,6\}" src/editor/components/PropertyPanel.vue
```

Expected: empty output.

- [ ] **Step 3: Run all gates**

```bash
. ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm test && pnpm lint && pnpm typecheck && pnpm format:check && pnpm build && pnpm e2e
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/editor/components/PropertyPanel.vue
git commit -m "style(theme): sweep PropertyPanel.vue to semantic tokens"
```

---

## Task 10: Sweep `src/editor/components/ValidationPanel.vue`

**Files:**
- Modify: `src/editor/components/ValidationPanel.vue`

| Old | New |
|---|---|
| `border-top: 1px solid #e5e7eb;` | `border-top: 1px solid var(--vg-border);` |
| `background: #fff;` | `background: var(--vg-surface);` |
| `color: #374151;` | `color: var(--vg-text);` |
| `background: #ef4444;` (error chip) | `background: var(--vg-error);` |
| `color: white;` (chip fg) | `color: var(--vg-text-on-accent);` |
| `color: #6b7280;` | `color: var(--vg-text-muted);` |
| `color: #b91c1c;` | `color: var(--vg-error);` |
| `color: #b45309;` | `color: var(--vg-warn);` |
| `border: 1px solid transparent;` | (unchanged — no color) |
| `background: transparent;` | (unchanged — no color) |
| `background: #f3f4f6;` (hover) | `background: var(--vg-surface-hover);` |
| `border-color: #d0d7de;` | `border-color: var(--vg-border);` |
| `color: #111827;` | `color: var(--vg-text);` |

The `color: white` on the error chip is a special case: white-on-red has high contrast on light theme but on the red-500 token (`#ff5c5c`) it may dip below 4.5:1. Use `--vg-text-on-accent` (which is `--vg-color-slate-950`, very dark) for safer contrast — axe will flag if it's wrong and Task 14 will recalibrate.

- [ ] **Step 1: Apply the sweep**

- [ ] **Step 2: Verify no hex literals remain**

```bash
grep -n "#[0-9a-fA-F]\{3,6\}" src/editor/components/ValidationPanel.vue
```

Expected: empty output.

- [ ] **Step 3: Run all gates**

```bash
. ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm test && pnpm lint && pnpm typecheck && pnpm format:check && pnpm build && pnpm e2e
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/editor/components/ValidationPanel.vue
git commit -m "style(theme): sweep ValidationPanel.vue to semantic tokens"
```

---

## Task 11: Sweep `src/editor/components/CanvasView.vue`

**Files:**
- Modify: `src/editor/components/CanvasView.vue`

| Old | New |
|---|---|
| `background: #fff;` | `background: var(--vg-surface);` |
| `border: 1px solid #d0d7de;` | `border: 1px solid var(--vg-border);` |
| `box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);` | `box-shadow: var(--vg-shadow-sm);` |
| `border-color: #d97706;` | `border-color: var(--vg-warn);` |
| `background: #fff7ed;` | `background: var(--vg-warn-bg);` |
| `border-color: #2563eb;` | `border-color: var(--vg-accent);` |
| `border-color: #b91c1c;` | `border-color: var(--vg-error);` |
| `background: #fef2f2;` | `background: var(--vg-error-bg);` |

- [ ] **Step 1: Apply the sweep**

- [ ] **Step 2: Verify no hex literals remain**

```bash
grep -n "#[0-9a-fA-F]\{3,6\}" src/editor/components/CanvasView.vue
```

Expected: empty output.

- [ ] **Step 3: Run all gates**

```bash
. ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm test && pnpm lint && pnpm typecheck && pnpm format:check && pnpm build && pnpm e2e
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/editor/components/CanvasView.vue
git commit -m "style(theme): sweep CanvasView.vue to semantic tokens"
```

---

## Task 12: Sweep `src/editor/components/CustomNode.vue`

**Files:**
- Modify: `src/editor/components/CustomNode.vue`

| Old | New |
|---|---|
| `background: #fff;` (node bg) | `background: var(--vg-surface);` |
| `border: 1px solid #d0d7de;` | `border: 1px solid var(--vg-border);` |
| `box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);` | `box-shadow: var(--vg-shadow-sm);` |
| `border-color: #d97706;` | `border-color: var(--vg-warn);` |
| `background: #fff7ed;` | `background: var(--vg-warn-bg);` |
| `border-color: #2563eb;` (selected) | `border-color: var(--vg-accent);` |
| `border-color: #b91c1c;` (error) | `border-color: var(--vg-error);` |
| `background: #fef2f2;` | `background: var(--vg-error-bg);` |
| `border-bottom: 1px solid #eaecef;` | `border-bottom: 1px solid var(--vg-border);` |
| `background: #f6f8fa;` (header strip) | `background: var(--vg-surface-2);` |
| `color: #6b7280;` | `color: var(--vg-text-muted);` |
| `color: #374151;` | `color: var(--vg-text);` |
| `color: #2563eb;` (port label) | `color: var(--vg-accent);` |
| `background: #2563eb;` (port handle) | `background: var(--vg-accent);` |
| `border: 1px solid #1e40af;` (handle border) | `border: 1px solid var(--vg-accent-hover);` |
| `border-top: 1px solid #eaecef;` | `border-top: 1px solid var(--vg-border);` |
| `color: #b91c1c;` | `color: var(--vg-error);` |

- [ ] **Step 1: Apply the sweep**

- [ ] **Step 2: Verify no hex literals remain**

```bash
grep -n "#[0-9a-fA-F]\{3,6\}" src/editor/components/CustomNode.vue
```

Expected: empty output.

- [ ] **Step 3: Run all gates**

```bash
. ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm test && pnpm lint && pnpm typecheck && pnpm format:check && pnpm build && pnpm e2e
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/editor/components/CustomNode.vue
git commit -m "style(theme): sweep CustomNode.vue to semantic tokens"
```

---

## Task 13: Sweep `src/editor/components/CommentNode.vue`

**Files:**
- Modify: `src/editor/components/CommentNode.vue`

The current style block (lines 79–98 of the file):

```css
.comment-node {
  min-width: 160px;
  min-height: 40px;
  padding: 8px 10px;
  border: 1px dashed #f59e0b;
  border-radius: 6px;
  background: #fffbeb;
  font-size: 12px;
  color: #78350f;
  white-space: pre-wrap;
  word-break: break-word;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
```

Replace with:

```css
.comment-node {
  min-width: 160px;
  min-height: 40px;
  padding: 8px 10px;
  border: 1px dashed var(--vg-warn);
  border-radius: 6px;
  background: var(--vg-warn-bg);
  font-size: 12px;
  color: var(--vg-warn);
  white-space: pre-wrap;
  word-break: break-word;
  box-shadow: var(--vg-shadow-sm);
}
```

The `.comment-node__text` and `.comment-node__editor` rules carry no color (only `inherit` and `transparent`); leave them.

- [ ] **Step 1: Apply the sweep**

- [ ] **Step 2: Verify no hex literals remain**

```bash
grep -n "#[0-9a-fA-F]\{3,6\}" src/editor/components/CommentNode.vue
```

Expected: empty output.

- [ ] **Step 3: Run all gates**

```bash
. ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm test && pnpm lint && pnpm typecheck && pnpm format:check && pnpm build && pnpm e2e
```

Expected: all green. The new a11y test must still pass against the now-fully-dark theme.

- [ ] **Step 4: Commit**

```bash
git add src/editor/components/CommentNode.vue
git commit -m "style(theme): sweep CommentNode.vue to semantic tokens"
```

---

## Task 14: Calibrate against axe; fix any failing primitives

**Files:**
- Modify (potentially): `src/styles/theme.css`

After Task 13, the theme is fully dark. The a11y test should still be green (it has been kept green at every step), but visual regressions or contrast slips on specific token combinations may surface.

- [ ] **Step 1: Run e2e and look for any axe violations or regressions**

```bash
. ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm e2e
```

Expected: all 7 tests pass.

- [ ] **Step 2: Manual smoke pass**

```bash
. ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm dev
```

Walk through:
- Editor shell renders dark.
- Add a Constant node from the palette → CustomNode reads dark with coral handle.
- Select the node → property panel reads dark.
- Type an invalid value → validation panel shows error chip; chip is legible.
- Add a Comment via TopBar → comment is amber-on-amber-tinted-bg, legible.
- Hover palette items → hover state visible.

Stop the dev server (Ctrl-C).

- [ ] **Step 3: If anything looks wrong**

Edit `src/styles/theme.css` primitives only — never reach into components. The two-layer split exists for exactly this kind of calibration. Common adjustments:
- Bump `--vg-color-slate-100` lighter if body text reads dim.
- Lighten `--vg-color-coral-500` if accent feels muddy.
- Shift `--vg-color-amber-500` warmer if comments look sickly.

Re-run the gates after any change.

- [ ] **Step 4: Commit (only if changes were made)**

```bash
git add src/styles/theme.css
git commit -m "fix(theme): calibrate primitives for visual + a11y"
```

If no changes were needed, skip this commit.

---

## Task 15: Update `PROJECT_MEMORY.md` and `CHANGELOG.md`

**Files:**
- Modify: `PROJECT_MEMORY.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update `PROJECT_MEMORY.md`**

Locate the "Resumption point — pick one of two remaining backlog items" section (line 17). Replace item 1 (the Theming bullet) with a completion line and renumber:

Old text:
```
1. **Theming (n8n-style dark theme + a11y audit)** — recommended next: lower architectural risk, broader polish. Introduces `useTheme` composable, swaps hard-coded colors to CSS variables with light/dark sets, axe pass via Playwright. Element Plus is still in `package.json` but unused at runtime — its CSS variable fallbacks are intentional and should keep working.
2. **Sub-graphs / grouping** — biggest remaining architectural change: touches schema, validator, compiler, canvas. Save for last.
```

New text:
```
1. **Sub-graphs / grouping** — final remaining backlog item; biggest architectural change: touches schema, validator, compiler, canvas.
```

Update the "Backlog progress" line (line 15) by appending `· ✅ Theming (dark-only, primitive+semantic tokens, axe gate)` to the existing list of checks.

Update the HEAD pointer (line 21) to the latest master SHA after merge — leave a placeholder note for the merging step:

```
Repo HEAD is `master` at `<post-merge-SHA>` with all four phase tags + 6 backlog commits pushed. Working tree clean. `pnpm test/lint/typecheck/format:check/build/e2e` all exit 0.
```

The actual SHA gets filled in during Task 16 after merge.

- [ ] **Step 2: Update `CHANGELOG.md`**

Read the file, find the most recent unreleased section (or the section that holds the previous backlog items), and append:

```
- Dark theme + a11y audit. Single n8n-style dark palette via CSS custom properties in `src/styles/theme.css`, structured as primitive (`--vg-color-*`) and semantic (`--vg-*`) layers. New `docs/theming.md` captures the contract for future contributors. New `tests/e2e/a11y.spec.ts` runs `@axe-core/playwright` and asserts zero serious/critical violations. The `[data-theme="dark"], :root` selector keeps a future toggle / additional themes a single sibling-block change away.
```

- [ ] **Step 3: Run all gates**

```bash
. ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm test && pnpm lint && pnpm typecheck && pnpm format:check && pnpm build && pnpm e2e
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add PROJECT_MEMORY.md CHANGELOG.md
git commit -m "docs: record dark-theme completion in memory + changelog"
```

---

## Task 16: Merge to master and push

**Files:**
- None (git operations only)

- [ ] **Step 1: Final clean-tree gate**

```bash
git status && \
  . ~/.nvm/nvm.sh && nvm use 22 >/dev/null && \
  pnpm test && pnpm lint && pnpm typecheck && pnpm format:check && pnpm build && pnpm e2e
```

Expected: working tree clean, all gates green.

- [ ] **Step 2: Merge with `--no-ff` for a clear feature merge**

```bash
git checkout master && \
  git merge --no-ff feat/dark-theme -m "Merge feat/dark-theme: dark theme + a11y audit"
```

- [ ] **Step 3: Update PROJECT_MEMORY.md HEAD pointer**

Get the new master SHA:

```bash
git rev-parse --short HEAD
```

Edit `PROJECT_MEMORY.md` line 21 and replace `<post-merge-SHA>` with the actual short SHA. Then:

```bash
git add PROJECT_MEMORY.md
git commit -m "docs(memory): pin HEAD post-merge"
```

- [ ] **Step 4: Push (uses GIT_ASKPASS + .git-token)**

```bash
git push origin master
```

Expected: push succeeds as morinf-TUM.

- [ ] **Step 5: Verify**

```bash
git log --oneline -5
git status
```

Expected: master at the merge commit + memory pin commit. Working tree clean.

---

## Self-review notes (for the executor)

This plan was self-reviewed at write time. If you find an issue while executing:
- A token in the mapping table that doesn't actually exist in the file you're sweeping → safe to skip.
- A hex literal in a file not covered by the table → consult `docs/theming.md`, choose the closest semantic token by intent (not by hue), and add a row to the table when committing.
- The a11y test failing after a sweep → don't proceed to the next sweep; calibrate the offending primitive in `theme.css` before continuing.
