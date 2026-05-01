# ADR-0005 — Persistence: download + file picker + localStorage autosave

**Status:** accepted (2026-05-01)

## Context

Editor-only project, no backend. The user must be able to save graph JSON to disk and reload it later, including across browser tabs and machines. Three persistence layers were considered:

- Browser download (`<a download>`) for save, `<input type="file">` for load.
- File System Access API (in-place save with persistent file handle) — Chromium-only.
- IndexedDB / localStorage for autosave only.

## Decision

- **Save:** trigger browser download of the JSON blob.
- **Load:** `<input type="file">`, parsed and Zod-validated.
- **Progressive enhancement:** when the File System Access API is available (`showOpenFilePicker`, `showSaveFilePicker`), use it for in-place save; gate via runtime feature detection.
- **Autosave:** serialise the current document to `localStorage` every 5 s while dirty; on app boot, if a stored draft exists, prompt the user before restoring.

## Consequences

- Works in every modern browser without polyfills.
- Chromium users get the better UX automatically.
- Autosave covers accidental tab closes; the prompt before restore avoids silent state surprises.
- localStorage size limit (~5 MB per origin) bounds maximum draft graph size in practice; warn at 4 MB.
- We do not need a backend, accounts, or sync infrastructure.
