#!/usr/bin/env node
// Thin shim that re-exec's the TypeScript CLI through tsx. Lets us ship a
// `vizgraph` binary without a separate build step. When the project later
// adopts a Node-target bundler, swap this for the bundled JS entry.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const cliEntry = join(here, "..", "src", "cli", "index.ts");
const tsxBin = join(here, "..", "node_modules", ".bin", "tsx");

const result = spawnSync(tsxBin, [cliEntry, ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
