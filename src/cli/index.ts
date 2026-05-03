import { readFileSync, writeFileSync } from "node:fs";
import { loadGraph } from "../serializer/index";
import { saveVersioned } from "../serializer/versioned";
import { validate } from "../validator/validate";
import { compile } from "../compiler/compile";
import type { Diagnostic } from "../validator/diagnostics";

// Headless CLI for the pure modules (validator + compiler + serializer).
// Reads accept either legacy or versioned JSON via the auto-detect dispatch.
// Exit codes:
//   0  success (no errors)
//   1  graph loaded but errors found / compile rejected
//   2  bad invocation: missing file, parse failure, schema failure, IO error

export interface CliStreams {
  stdout: { write(s: string): void };
  stderr: { write(s: string): void };
}

interface ValidateOpts {
  file: string;
  json: boolean;
  warningsAsErrors: boolean;
}

interface CompileOpts {
  file: string;
  out: string | undefined;
  pretty: boolean;
}

const formatDiagnostic = (d: Diagnostic): string => {
  const sev = d.severity.padEnd(7);
  const code = d.code.padEnd(28);
  const loc =
    d.node_id !== undefined
      ? `node ${String(d.node_id)}`
      : d.edge_id !== undefined
        ? `edge ${d.edge_id}`
        : "";
  const locTag = loc ? ` [${loc}]` : "";
  return `${sev} ${code} ${d.message}${locTag}`;
};

type ReadResult = { ok: true; data: unknown } | { ok: false; code: number };

const readJson = (file: string, streams: CliStreams): ReadResult => {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (err) {
    streams.stderr.write(`error: cannot read ${file}: ${String(err)}\n`);
    return { ok: false, code: 2 };
  }
  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch (err) {
    streams.stderr.write(`error: ${file} is not valid JSON: ${String(err)}\n`);
    return { ok: false, code: 2 };
  }
};

const cmdValidate = (opts: ValidateOpts, streams: CliStreams): number => {
  const parsed = readJson(opts.file, streams);
  if (!parsed.ok) return parsed.code;
  const loaded = loadGraph(parsed.data);
  if (!loaded.success) {
    streams.stderr.write(`error: ${loaded.error}\n`);
    return 2;
  }
  const diagnostics = validate(loaded.data);

  if (opts.json) {
    streams.stdout.write(`${JSON.stringify(diagnostics, null, 2)}\n`);
  } else {
    for (const d of diagnostics) streams.stdout.write(`${formatDiagnostic(d)}\n`);
    const errors = diagnostics.filter((d) => d.severity === "error").length;
    const warnings = diagnostics.filter((d) => d.severity === "warning").length;
    streams.stdout.write(`${String(errors)} error(s), ${String(warnings)} warning(s)\n`);
  }

  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warningCount = diagnostics.filter((d) => d.severity === "warning").length;
  if (errorCount > 0) return 1;
  if (opts.warningsAsErrors && warningCount > 0) return 1;
  return 0;
};

const cmdCompile = (opts: CompileOpts, streams: CliStreams): number => {
  const parsed = readJson(opts.file, streams);
  if (!parsed.ok) return parsed.code;
  const loaded = loadGraph(parsed.data);
  if (!loaded.success) {
    streams.stderr.write(`error: ${loaded.error}\n`);
    return 2;
  }
  const diagnostics = validate(loaded.data);
  const errors = diagnostics.filter((d) => d.severity === "error");
  if (errors.length > 0) {
    streams.stderr.write(`compile aborted: ${String(errors.length)} validation error(s):\n`);
    for (const d of errors) streams.stderr.write(`  ${formatDiagnostic(d)}\n`);
    return 1;
  }
  let compiled;
  try {
    compiled = compile(loaded.data).graph;
  } catch (err) {
    streams.stderr.write(`error: compile failed: ${String(err)}\n`);
    return 1;
  }
  const json = opts.pretty ? JSON.stringify(compiled, null, 2) : JSON.stringify(compiled);
  if (opts.out !== undefined) {
    try {
      writeFileSync(opts.out, `${json}\n`, "utf8");
    } catch (err) {
      streams.stderr.write(`error: cannot write ${opts.out}: ${String(err)}\n`);
      return 2;
    }
  } else {
    streams.stdout.write(`${json}\n`);
  }
  return 0;
};

const cmdRoundtrip = (opts: { file: string; pretty: boolean }, streams: CliStreams): number => {
  const parsed = readJson(opts.file, streams);
  if (!parsed.ok) return parsed.code;
  const loaded = loadGraph(parsed.data);
  if (!loaded.success) {
    streams.stderr.write(`error: ${loaded.error}\n`);
    return 2;
  }
  // Use saveVersioned to canonicalise; if --pretty was not requested, drop the
  // 2-space indent.
  const versioned = saveVersioned(loaded.data);
  const out = opts.pretty ? versioned : JSON.stringify(JSON.parse(versioned));
  streams.stdout.write(`${out}\n`);
  return 0;
};

const HELP = `vizgraph - n8n-port headless CLI

Usage:
  vizgraph validate <file.json> [--json] [--warnings-as-errors]
  vizgraph compile  <file.json> [--out <out.json>] [--pretty]
  vizgraph roundtrip <file.json> [--pretty]
  vizgraph help

validate    Loads the graph (legacy or versioned), runs every validator
            rule, prints diagnostics. Exit 0 = clean, 1 = errors found,
            2 = bad invocation. --json prints the Diagnostic[] as JSON.

compile     Loads + validates; if no errors, emits the runtime-bound JSON
            (legacy shape + optional per-node frequency_hz). Defaults to
            stdout; --out writes to a file.

roundtrip   Loads (legacy or versioned) and re-emits the canonical
            versioned form. Useful for migrating legacy fixtures.
`;

export const main = (argv: readonly string[], streams: CliStreams): number => {
  const [cmd, ...rest] = argv;
  if (cmd === undefined || cmd === "help" || cmd === "--help" || cmd === "-h") {
    streams.stdout.write(HELP);
    return cmd === undefined ? 2 : 0;
  }

  if (cmd === "validate") {
    let file: string | undefined;
    let json = false;
    let warningsAsErrors = false;
    for (const arg of rest) {
      if (arg === "--json") json = true;
      else if (arg === "--warnings-as-errors") warningsAsErrors = true;
      else if (!arg.startsWith("-") && file === undefined) file = arg;
      else {
        streams.stderr.write(`error: unrecognised argument: ${arg}\n`);
        return 2;
      }
    }
    if (file === undefined) {
      streams.stderr.write("error: validate requires a file argument\n");
      return 2;
    }
    return cmdValidate({ file, json, warningsAsErrors }, streams);
  }

  if (cmd === "compile") {
    let file: string | undefined;
    let out: string | undefined;
    let pretty = false;
    let i = 0;
    while (i < rest.length) {
      const arg = rest[i];
      if (arg === "--pretty") {
        pretty = true;
      } else if (arg === "--out") {
        const next = rest[i + 1];
        if (next === undefined) {
          streams.stderr.write("error: --out requires a path\n");
          return 2;
        }
        out = next;
        i += 1;
      } else if (arg !== undefined && !arg.startsWith("-") && file === undefined) {
        file = arg;
      } else {
        streams.stderr.write(`error: unrecognised argument: ${String(arg)}\n`);
        return 2;
      }
      i += 1;
    }
    if (file === undefined) {
      streams.stderr.write("error: compile requires a file argument\n");
      return 2;
    }
    return cmdCompile({ file, out, pretty }, streams);
  }

  if (cmd === "roundtrip") {
    let file: string | undefined;
    let pretty = false;
    for (const arg of rest) {
      if (arg === "--pretty") pretty = true;
      else if (!arg.startsWith("-") && file === undefined) file = arg;
      else {
        streams.stderr.write(`error: unrecognised argument: ${arg}\n`);
        return 2;
      }
    }
    if (file === undefined) {
      streams.stderr.write("error: roundtrip requires a file argument\n");
      return 2;
    }
    return cmdRoundtrip({ file, pretty }, streams);
  }

  streams.stderr.write(`error: unknown command "${cmd}"\n${HELP}`);
  return 2;
};

// Entry-point guard: when the file is run directly (not imported by tests),
// dispatch to main with process.argv and exit with the returned code.
const directInvocation = (): boolean => {
  if (typeof process === "undefined" || !process.argv[1]) return false;
  // We're invoked via `tsx src/cli/index.ts` or `node dist-cli/index.js`.
  // process.argv[1] is the entry script; matching via endsWith covers both.
  const entry = process.argv[1];
  return entry.endsWith("/cli/index.ts") || entry.endsWith("/cli/index.js");
};

if (directInvocation()) {
  const code = main(process.argv.slice(2), { stdout: process.stdout, stderr: process.stderr });
  process.exit(code);
}
