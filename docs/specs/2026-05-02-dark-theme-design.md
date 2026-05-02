# Dark Theme + a11y Audit — Design

Date: 2026-05-02
Status: Accepted (pre-implementation)
Scope: Editor visual layer only. No new runtime, no schema/validator/compiler changes.

## Goal

Replace the current ad-hoc light styling with a single n8n-style dark theme, defined as CSS custom properties, and add a Playwright-driven `axe` accessibility check that gates regressions.

## Non-goals

- No light theme. No runtime toggle. No `useTheme` composable. No `prefers-color-scheme` media query. No localStorage persistence.
- No restyling or layout changes beyond color, border, and shadow values.
- No replacement of Element Plus tokens. Element Plus is in `package.json` but not registered at runtime; existing `var(--el-*-, #fallback)` lookups resolve to the fallback. We update fallbacks; the `--el-*` reference stays as-is so the file remains diff-friendly if Element Plus is ever re-enabled.
- No Vue Flow theme integration beyond what bleeds in through inherited `color`/`background` and edge stroke tokens we already control.

## Architecture

### New file: `src/styles/theme.css`

Imported once from `src/main.ts` (after any Vue Flow CSS imports, so it wins specificity ties). Exports CSS custom properties only — no selectors, no resets, no Element Plus overrides.

Two-layer token structure:

- **Primitive layer** (`:root`) — raw palette values (`--vg-color-*`). Never consumed by components.
- **Semantic layer** (`[data-theme="dark"], :root`) — what components consume (`--vg-bg`, `--vg-accent`, …). Each semantic token is `var(--vg-color-*)`.

Two consequences for future modification:

1. Adding a light / high-contrast / user theme is a sibling block — `[data-theme="light"] { --vg-bg: var(--vg-color-…); … }` — with zero component changes. A future toggle is one line setting `data-theme` on `<html>`.
2. Brand recolors hit one primitive; intent remaps hit one semantic; component CSS never moves.

### New file: `docs/theming.md`

A one-page contract listing every semantic token and its intended use (e.g. "`--vg-surface-2` is for raised cards / inset wells, NOT for selected state — use `--vg-accent-bg` for selection"). Single source of truth for contributors. Updated whenever a new token lands.

### Sweep targets

1. `src/App.vue`
2. `src/editor/components/CanvasView.vue`
3. `src/editor/components/CommentNode.vue`
4. `src/editor/components/CustomNode.vue`
5. `src/editor/components/Palette.vue`
6. `src/editor/components/PropertyPanel.vue`
7. `src/editor/components/TopBar.vue`
8. `src/editor/components/ValidationPanel.vue`

In each file: replace every hard-coded hex / `rgba()` / named color in `<style>` blocks with `var(--vg-*)`. Preserve existing `var(--el-*, fallback)` shape but swap the fallback to a dark equivalent.

### New e2e test: `tests/e2e/a11y.spec.ts`

Uses `@axe-core/playwright`. Loads the editor, waits for the canvas to render, runs `AxeBuilder.analyze()`, asserts zero violations at `serious` or `critical` impact across the WCAG 2.1 AA ruleset.

## Token palette

All values are starting points. The implementation phase calibrates anything axe flags below 4.5:1 (body text) or 3:1 (large text, UI components).

```css
:root {
  /* ── Primitive layer — raw palette, never consumed by components ── */
  --vg-color-slate-950: #1a1d23;
  --vg-color-slate-900: #23272e;
  --vg-color-slate-800: #2c313a;
  --vg-color-slate-750: #323843;
  --vg-color-slate-700: #3a3f47;
  --vg-color-slate-600: #4a505a;
  --vg-color-slate-300: #9aa1ad;
  --vg-color-slate-400: #6b7280;
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

  /* Accent (n8n coral) */
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

**Component contract:** components read only the semantic layer (`var(--vg-bg)`, etc.). Reaching for primitives (`var(--vg-color-coral-500)`) from a component is a smell — it means the component has its own intent that wants its own semantic token. Add the token, don't bypass the layer.

### Token-to-current-color mapping

| Old (hex / role)                             | New token                |
|----------------------------------------------|--------------------------|
| `#fafafa`, `#fff` (page bg, panel bg)        | `--vg-bg`, `--vg-surface`|
| `#f1f5f9`, `#f6f8fa` (raised, header bg)     | `--vg-surface-2`         |
| `#f3f4f6` (hover)                            | `--vg-surface-hover`     |
| `#d0d7de`, `#e5e7eb`, `#eaecef`, `#eee`      | `--vg-border`            |
| `#111827`, `#374151`                         | `--vg-text`              |
| `#6b7280`, `#9ca3af`                         | `--vg-text-muted`/`-subtle` |
| `#2563eb`, `#1e40af`, `#dbeafe`              | `--vg-accent`*, `--vg-accent-bg` |
| `#d97706`, `#b45309`, `#fff7ed`, `#fffbeb`, `#f59e0b`, `#78350f` | `--vg-warn`, `--vg-warn-bg` |
| `#b91c1c`, `#ef4444`, `#fef2f2`              | `--vg-error`, `--vg-error-bg` |
| `rgba(0, 0, 0, 0.04)`, `…0.05`               | `--vg-shadow-sm`         |

\* The current selected/link blue (`#2563eb`) becomes coral. If user testing reveals coral is too aggressive for "selected" semantics, `--vg-info` (`#6ab0ff`) is the fallback secondary.

## Data flow

No runtime data flow change. CSS custom properties cascade; components read tokens at paint time.

## Error handling

Not applicable (CSS-only change). The axe test is the regression gate.

## Testing strategy

- All 31 Vitest files / 6 existing Playwright cases must stay green. Color-only changes should not move test logic; if any snapshot test fails, the snapshot is stale and gets updated.
- New `tests/e2e/a11y.spec.ts` adds one Playwright case asserting `serious` + `critical` axe violations are empty.
- Manual smoke pass with `pnpm dev`: open canvas, add nodes, connect them, open property panel, trigger a validation error, add a comment, ensure nothing reads as unstyled.

## Risks

- **Snapshot/visual diff churn.** No image-snapshot tests exist in this repo (verified by grepping `tests/` for `toMatchSnapshot`); risk is low.
- **Vue Flow internal styles** may show through (edge stroke, handle dots). Acceptable for this pass; tracked under follow-up if visually obvious.
- **Element Plus fallback drift.** If Element Plus is ever re-registered at runtime, the `--el-*` lookups will resolve to its light values and override the dark fallbacks. We accept this and document it in `PROJECT_MEMORY.md`.
- **Coral as "selected" color** is a departure from the conventional blue. Calibrated against the n8n product reference; if it tests badly during the implementation smoke pass we swap to `--vg-info`.

## Out-of-band updates

`PROJECT_MEMORY.md` "Resumption point" item 1 currently mentions a `useTheme` composable. The implementation phase removes that mention and records the dark-only decision.

## Implementation order (preview, fleshed out by writing-plans)

1. Add `@axe-core/playwright` devDep.
2. Create `src/styles/theme.css` with the two-layer palette above; import in `main.ts`. Set `data-theme="dark"` on `<html>` in `index.html` so the attribute selector matches even though `:root` already does.
3. Write `docs/theming.md` listing every semantic token + intended use.
4. Sweep components in order: App.vue → TopBar → Palette → PropertyPanel → ValidationPanel → CanvasView → CustomNode → CommentNode. Components consume semantic tokens only.
5. Add `tests/e2e/a11y.spec.ts`; calibrate any failing tokens by editing primitives.
6. Update `PROJECT_MEMORY.md` + `CHANGELOG.md`.
7. All gates green; merge to master.
