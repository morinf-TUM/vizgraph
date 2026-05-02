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
