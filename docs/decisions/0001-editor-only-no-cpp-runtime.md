# ADR-0001 — Editor-only, no in-repo C++ runtime

**Status:** accepted (2026-05-01)

## Context

The adaptation prompt describes a C++ DAG runtime (`GraphMT`, `NodeMT`, `EdgeMT`). When this project began, the C++ source was not present in this directory. Three options were considered:

1. Reference an existing C++ codebase elsewhere on the user's machine.
2. Scaffold a minimal C++ runtime stub matching the prompt's contract here.
3. Treat the runtime as out-of-scope; produce only the editor and a versioned JSON document the runtime can later consume.

## Decision

Option 3. The runtime stays out of this repository. The editor produces a canonical "runtime-bound JSON" via the `GraphCompiler` module — no C++ types are stubbed in TypeScript.

## Consequences

- The `GraphCompiler` from the prompt is reinterpreted: it serialises a finalised export shape rather than instantiating C++ classes. The output is the contract the external runtime must accept.
- The export shape is part of this project's public surface and must remain stable across editor versions, or carry an explicit version field.
- The prompt's Phase-4 ("execution and observability") cannot run graphs here. Phase 4 is reinterpreted in ADR-0006.
- We never need to ship a build toolchain for C++ in this repository.
- Risk: the export shape may drift from what a future C++ runtime expects. Mitigation — keep the export schema small, well-documented, and identical to the on-disk `GraphDocument` until a runtime author raises a concrete conflict.
