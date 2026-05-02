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

Single `:root` block. Imported once from `src/main.ts` (after any Vue Flow CSS imports, so it wins specificity ties). Exports CSS custom properties only — no selectors, no resets, no Element Plus overrides.

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
  /* Surfaces */
  --vg-bg: #1a1d23;
  --vg-surface: #23272e;
  --vg-surface-2: #2c313a;
  --vg-surface-hover: #323843;

  /* Borders */
  --vg-border: #3a3f47;
  --vg-border-strong: #4a505a;

  /* Text */
  --vg-text: #e6e8eb;
  --vg-text-muted: #9aa1ad;
  --vg-text-subtle: #6b7280;
  --vg-text-on-accent: #1a1d23;

  /* Accent (n8n coral) */
  --vg-accent: #ff6d5a;
  --vg-accent-hover: #ff8676;
  --vg-accent-bg: #3a2522;

  /* Status */
  --vg-warn: #f5a623;
  --vg-warn-bg: #3a2c14;
  --vg-error: #ff5c5c;
  --vg-error-bg: #3a1f1f;
  --vg-info: #6ab0ff;
  --vg-info-bg: #1c2a3a;

  /* Effects */
  --vg-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.35);
  --vg-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.45);
  --vg-focus-ring: 0 0 0 2px var(--vg-accent);
}
```

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
2. Create `src/styles/theme.css` with the palette above; import in `main.ts`.
3. Sweep components in order: App.vue → TopBar → Palette → PropertyPanel → ValidationPanel → CanvasView → CustomNode → CommentNode.
4. Add `tests/e2e/a11y.spec.ts`; calibrate any failing tokens.
5. Update `PROJECT_MEMORY.md` + `CHANGELOG.md`.
6. All gates green; merge to master.
