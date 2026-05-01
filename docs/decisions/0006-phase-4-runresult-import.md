# ADR-0006 — Phase 4 reinterpreted as RunResult import

**Status:** accepted (2026-05-01)

## Context

The prompt's Phase 4 ("Execution and Observability") asks for: run graph from editor, show per-node execution result, surface validation and runtime errors, optionally display timing/telemetry. Under ADR-0001 the editor cannot execute graphs — there is no in-repo runtime.

## Decision

Phase 4 is reinterpreted: the editor imports a `RunResult` JSON file produced by an external runtime, then overlays per-node values, durations, and errors on the canvas. A "Mode" toggle in the top bar switches between Edit and Inspect; Inspect mode is read-only and shows overlays.

The `RunResult` schema (defined in the design spec §6.4) is part of this project's public contract.

## Consequences

- The runtime author is responsible for emitting a conformant `RunResult` JSON. We provide the schema (Zod) and at least one sample fixture.
- No execution code path in the editor.
- Mode toggle keeps overlays from polluting the persisted graph — the document is never mutated by Inspect mode.
- Multi-tick browsing is a stretch goal: v1 only displays a single tick (the last one if multiple are present).
- If a future runtime exposes a streaming protocol (WebSocket, SSE), it can be layered on top without changing the editor's data model — `executionStore` simply receives `RunResult` slices over time.
