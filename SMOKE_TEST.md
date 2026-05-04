# n8n-port — Human Smoke Test

Step-by-step checklist for a human operator to exercise every shipped feature
end-to-end against a freshly-built dev server. Time budget: ~20 minutes if
nothing breaks. Tick each `[ ]` as you go.

## 0 · Pre-flight

- [ ] `node --version` reports v22.x (use `nvm use 22` if not).
- [ ] `pnpm --version` works.
- [ ] In `/home/fom/code/n8n_port`:
  - [ ] `pnpm install` exits 0.
  - [ ] `pnpm build` produces `dist/`.
  - [ ] `pnpm test` reports 47 files / 297 tests passing.
  - [ ] `pnpm e2e` reports 12 cases passing. *(slow; optional if `pnpm test` is green)*
- [ ] `pnpm dev` is running and the editor is open at `http://localhost:5173`
      (or whatever Vite reports).

> Keep the dev server running for the rest of the test. Browser DevTools open
> is helpful — there should be **zero** console errors at any point.

## 1 · Editor shell

- [ ] On load you see four regions:
  - [ ] Top bar (centred title `n8n-port`, file/edit buttons left, mode/runresult right).
  - [ ] Palette (left sidebar, search box + `Sources` / `Math` / `Sinks` categories).
  - [ ] Canvas (centre, dark background, dotted grid).
  - [ ] Property panel (right sidebar, says "Select a node to edit it.").
  - [ ] Validation panel (bottom, empty / no diagnostics).
- [ ] The page passes a manual contrast read — text is readable, accent colour
      is the n8n coral, no obvious dark-on-dark or light-on-light blocks.

## 2 · Add nodes — click and drag

- [ ] Click `Constant` in the palette → one node lands at top-left of canvas.
- [ ] Click `Add` → second node appears.
- [ ] Click `Print` → third node appears.
- [ ] **Drag-to-add**: drag `Constant` from the palette and drop it in the
      empty area to the right of `Print`. A new `Constant` lands at the
      cursor's position (not at the top-left default).
- [ ] Top bar shows `unsaved` indicator.
- [ ] Validation panel shows several `isolated_node` warnings (one per
      unconnected node).

## 3 · Connect / wire

- [ ] Drag from the right-hand handle of the first `Constant` to the `a`
      input of the `Add` node — edge appears.
- [ ] Drag from the second `Constant` to `Add.b`.
- [ ] Drag from `Add.sum` to `Print.in`.
- [ ] `isolated_node` warnings clear for the wired nodes.
- [ ] **Negative case**: try to drag from `Add.sum` to `Constant`'s output
      handle (output→output). The connection is rejected (no edge added).

## 4 · PropertyPanel edits

- [ ] Click the first `Constant` → property panel shows `id`, `type`, `name`,
      `value`.
- [ ] Type a name (e.g. `Two`) in the name field. Tab away — node label
      updates on the canvas.
- [ ] Set `value` to `2`, blur. The validation panel does not flag a type error.
- [ ] Set the second `Constant.value` to `3`.

## 5 · Comments — free-floating

- [ ] Click the `+ Comment` (or "Comment") button in the top bar — a
      yellow/amber dashed-border note appears on the canvas.
- [ ] Double-click the comment → inline textarea. Type some text. Press
      `Ctrl+Enter` (or click outside) to commit.
- [ ] Drag the comment to a new position — it stays where you dropped it.

## 6 · Comments — anchored

- [ ] Click the `Print` node to select it.
- [ ] In the property panel, click `+ comment attached to this node`.
- [ ] A comment appears offset above-right of the `Print` node.
- [ ] **Drag the `Print` node** somewhere else — the anchored comment moves
      with it (preserving its relative offset).
- [ ] **Drag the anchored comment alone** — it moves; node stays put. The
      offset is now smaller/larger depending on direction. Drag the node
      again — comment still follows by the new delta.
- [ ] Select `Print`, press `Delete` (or `Backspace`). The node is removed
      and any incident edges with it. The anchored comment **stays** but is
      no longer attached: dragging a different node does not move it.
      *(Verify by Ctrl+Z to restore — anchor does not auto-restore; that's
      intentional for v1.)*

## 7 · Save / Open

- [ ] Click `Save` in the top bar → browser downloads `graph.json`.
- [ ] Click `New` → canvas clears.
- [ ] Click `Open` → file picker → choose the `graph.json` you just
      downloaded. The full graph (nodes, edges, comments — including the
      attached one) is restored.
- [ ] **JSON inspection**: open `graph.json` in a text editor. Verify the
      attached comment has `"attachedTo": { "node": <id> }`.

## 8 · Keyboard shortcuts

- [ ] **Ctrl+S** triggers a download (works while focus is on the canvas).
- [ ] **Ctrl+O** opens a file picker.
- [ ] **F** fits the canvas viewport to the graph.
- [ ] **Ctrl+Z** undoes the last action; **Ctrl+Y** (or Ctrl+Shift+Z) redoes it.
- [ ] Click a node, **Ctrl+C** then **Ctrl+V** — a duplicate appears with a new id.
- [ ] Click a node, press **Delete** — node and incident edges removed.
- [ ] Type in the palette search field and press Ctrl+Z — typing is *not*
      hijacked by undo (editable-target skip rule).

## 9 · Tidy / auto-layout

- [ ] Add a few unconnected nodes scattered randomly.
- [ ] Click the `Tidy` button in the top bar.
- [ ] The graph re-flows left-to-right with sensible spacing (Dagre LR layout).

## 10 · Validation panel

- [ ] Add a single `Constant` and leave it unconnected → `isolated_node`
      warning appears in the panel.
- [ ] Click the warning row → the corresponding node highlights / scrolls
      into view (click-to-jump).
- [ ] Trigger a port-type mismatch (if your built-ins permit) — the panel
      shows a `port_type_mismatch` error in red.
- [ ] Each error / warning row shows its `code` (`isolated_node`,
      `invalid_target_port`, etc.) — these are the machine-readable codes the
      runtime contract relies on.

## 11 · Sub-graphs

- [ ] Build a 4-node graph: `Constant` → `Add.a`, `Constant` → `Add.b`,
      `Add.sum` → `Print.in`.
- [ ] Click the `Add` node only. Top bar's `Group` button is enabled.
- [ ] Click `Group`. The `Add` is replaced by a `Subgraph` node at root level.
- [ ] Breadcrumbs show `root`.
- [ ] **Double-click the `Subgraph` node** → you drill into it. Breadcrumbs
      become `root  ›  Subgraph #N`. Inside you see two `SubgraphInput`
      pseudo-nodes, one `Add`, one `SubgraphOutput`.
- [ ] Click the first `SubgraphInput`. Property panel shows `port name` and
      `port type` fields. Rename it from its default to `alpha` and **click
      away** (blur). The panel value persists.
- [ ] Click `root` in the breadcrumbs to drill out. The outer `Subgraph`
      node now exposes a port named `alpha` on its left side.
- [ ] **Outer wiring stays consistent**: the edge that previously connected
      `Constant.out` → `Subgraph.<original>` now connects to
      `Subgraph.alpha`.
- [ ] Save → re-open. The full subgraph round-trips. Inspect the JSON: the
      `Subgraph` node has `parameters.children.graph.nodes` with the inner
      `Add` and pseudo-nodes.

## 12 · Run-result import & Inspect mode

- [ ] Build a graph that matches `fixtures/legacy/simple-add.json` ids
      (1 = Constant, 2 = Constant, 3 = Add, 4 = Print) — or load that fixture
      via Open.
- [ ] Top bar mode reads `edit`. The Edit↔Inspect toggle is **disabled**
      until a run-result is loaded.
- [ ] Click `Import RunResult` → choose a sample run-result JSON
      (build one with one tick, four node entries).
- [ ] Mode switches to `inspect` automatically.
- [ ] Output overlays appear on each node — e.g. `out: 2`, `out: 3`, `sum: 5`.
- [ ] If your run-result has multiple ticks: the top bar shows `◀  tick i / N  ▶`.
      Click `▶` → overlays for the next tick render. Disabled correctly at
      tick 0 / tick N-1.
- [ ] Click the toggle → mode is `edit`, overlays disappear.

## 13 · Canvas controls / minimap

- [ ] Bottom-right shows VueFlow controls: zoom-in, zoom-out, fit-view,
      lock toggle. Each has a tooltip / aria-label.
- [ ] Click the lock → editing is disabled (cannot drag nodes, cannot
      connect). Click again to unlock.
- [ ] Minimap (bottom-right, above controls) shows the whole graph; clicking
      a region pans the main viewport.

## 14 · Headless CLI (vizgraph)

In a separate terminal:

- [ ] `pnpm cli --help` (or `node bin/vizgraph.mjs --help`) prints usage.
- [ ] `pnpm cli validate fixtures/legacy/simple-add.json` exits 0 with no
      errors (warnings are fine).
- [ ] `pnpm cli validate fixtures/legacy/parallel-add.json` exits 0.
- [ ] `pnpm cli compile fixtures/legacy/simple-add.json` prints a JSON
      object with `nodes` and `edges` (the runtime-bound shape — no `version`
      key, no editor-only fields).
- [ ] **Round-trip**: save a graph from the editor, then
      `pnpm cli compile <saved.json>` — the output is the flattened runtime
      JSON. If your saved graph contained a Subgraph, it is flattened away
      (no `Subgraph` / `SubgraphInput` / `SubgraphOutput` types in the
      output).

## 15 · Dark theme + a11y feel

- [ ] Whole UI uses the n8n-style dark palette — primary surface is dark
      grey, accent is coral.
- [ ] Tab through the UI from the URL bar — focus rings are visible on
      every interactive element.
- [ ] Run an `axe-core` check via DevTools or the browser extension — zero
      `serious` / `critical` violations. *(also covered by `pnpm e2e`'s
      a11y gate.)*

## 16 · Final regression sweep

- [ ] Reload the page — the empty editor renders cleanly with no console
      errors.
- [ ] Repeat the Save → New → Open cycle on the kitchen-sink graph from
      step 11 once more. The document is byte-equivalent (modulo viewport
      drift if you panned).

If any box above failed, capture the steps and the console output and
report it. If everything is ticked, the build is green from a human's
perspective too.
