# ADR-0004 — Command-pattern undo/redo

**Status:** accepted (2026-05-01)

## Context

Two ways to implement undo/redo on a graph:

- **State snapshots** — push a deep clone of the document on every change. Simple but quadratic memory and unable to capture intent (e.g., to pair "delete node" with cascading edge deletions cleanly).
- **Command pattern** — every mutation is a `Command` with `do(state)` and `undo(state)`. Composable, intent-preserving, scales to large graphs.

n8n's editor uses a command-style history helper (see `packages/frontend/editor-ui` history modules).

## Decision

Command pattern. Each canvas operation produces a `Command` instance; multi-select operations bundle into a `CompositeCommand`. `historyStore` maintains forward/backward stacks bounded at depth 200.

## Consequences

- Every store mutation entry point must go through a command — direct store mutation will silently bypass undo and is a bug.
- Tests can replay command sequences for deterministic state assertions.
- Commands are serialisable in principle, leaving open future features (replay, time-travel debugging) without requiring redesign.
- Slight up-front complexity vs snapshots, paid back from Phase 3 onward.
