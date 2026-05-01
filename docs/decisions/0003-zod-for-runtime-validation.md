# ADR-0003 — Zod for runtime JSON validation

**Status:** accepted (2026-05-01)

## Context

The editor loads arbitrary JSON from disk (legacy fixtures, versioned saves, imported run-results). The prompt requires structured diagnostics with codes, paths, and severities — type-only validation cannot produce that. n8n itself uses TypeScript types only and accepts no external graph JSON, so its approach does not transfer.

Candidates: **Zod** (most popular, mature, schema-first), **Valibot** (smaller bundle, similar API, newer), or hand-rolled validation.

## Decision

Use Zod for all runtime parsing of JSON entering the editor: legacy graph JSON, versioned graph JSON, and `RunResult` JSON. Each schema is exported alongside its TS type so we have a single source for both compile-time and run-time.

## Consequences

- Precise error paths (`issues[].path`) feed directly into our `Diagnostic.field`.
- Bundle cost is acceptable for a desktop-class editor.
- A deliberate deviation from n8n; recorded here so future readers don't try to "match n8n" by removing it.
- Migration cost if Zod's API changes substantially — acceptable: Zod has been stable through several major versions.
