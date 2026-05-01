import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../../../src/cli";

class StringStream {
  buf = "";
  write(s: string): void {
    this.buf += s;
  }
}

let workdir: string;
beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), "vizgraph-cli-"));
});
afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

const writeJson = (name: string, body: unknown): string => {
  const path = join(workdir, name);
  writeFileSync(path, JSON.stringify(body, null, 2), "utf8");
  return path;
};

const cleanLegacy = () => ({
  nodes: [
    { uid: 1, name: "Two", type: "Constant", value: 2 },
    { uid: 2, name: "Three", type: "Constant", value: 3 },
    { uid: 3, name: "Adder", type: "Add" },
    { uid: 4, name: "Output", type: "Print" },
  ],
  edges: [
    { src: 1, dst: 3, port_out: "out", port_in: "a" },
    { src: 2, dst: 3, port_out: "out", port_in: "b" },
    { src: 3, dst: 4, port_out: "sum", port_in: "in" },
  ],
});

describe("CLI", () => {
  it("help: prints usage and exits 0 with explicit `help`", () => {
    const out = new StringStream();
    const err = new StringStream();
    expect(main(["help"], { stdout: out, stderr: err })).toBe(0);
    expect(out.buf).toMatch(/Usage:/);
  });

  it("help: exits 2 with no args, still prints usage", () => {
    const out = new StringStream();
    const err = new StringStream();
    expect(main([], { stdout: out, stderr: err })).toBe(2);
    expect(out.buf).toMatch(/Usage:/);
  });

  it("unknown command: exits 2 with an error", () => {
    const err = new StringStream();
    expect(main(["wat"], { stdout: new StringStream(), stderr: err })).toBe(2);
    expect(err.buf).toMatch(/unknown command/);
  });

  it("validate: clean simple-add legacy graph exits 0", () => {
    const path = writeJson("clean.json", cleanLegacy());
    const out = new StringStream();
    expect(main(["validate", path], { stdout: out, stderr: new StringStream() })).toBe(0);
    expect(out.buf).toMatch(/0 error\(s\), 0 warning\(s\)/);
  });

  it("validate: missing file returns 2 and writes an error to stderr", () => {
    const err = new StringStream();
    expect(
      main(["validate", join(workdir, "no-such-file.json")], {
        stdout: new StringStream(),
        stderr: err,
      }),
    ).toBe(2);
    expect(err.buf).toMatch(/cannot read/);
  });

  it("validate: invalid JSON returns 2", () => {
    const path = join(workdir, "bad.json");
    writeFileSync(path, "{ not json", "utf8");
    const err = new StringStream();
    expect(main(["validate", path], { stdout: new StringStream(), stderr: err })).toBe(2);
    expect(err.buf).toMatch(/not valid JSON/);
  });

  it("validate: schema-failing JSON returns 2", () => {
    const path = writeJson("wrong-version.json", { version: 99, graph: { nodes: [], edges: [] } });
    const err = new StringStream();
    expect(main(["validate", path], { stdout: new StringStream(), stderr: err })).toBe(2);
    expect(err.buf.length).toBeGreaterThan(0);
  });

  it("validate: graph with errors returns 1 and lists each diagnostic", () => {
    const path = writeJson("bad.json", {
      version: 1,
      graph: {
        nodes: [
          { id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: {} },
          { id: 1, type: "Print", position: { x: 100, y: 0 } },
        ],
        edges: [],
      },
    });
    const out = new StringStream();
    expect(main(["validate", path], { stdout: out, stderr: new StringStream() })).toBe(1);
    expect(out.buf).toMatch(/duplicate_node_id/);
    expect(out.buf).toMatch(/missing_required_parameter/);
  });

  it("validate --json: emits machine-readable Diagnostic[]", () => {
    const path = writeJson("bad.json", {
      version: 1,
      graph: {
        nodes: [{ id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: {} }],
        edges: [],
      },
    });
    const out = new StringStream();
    main(["validate", path, "--json"], { stdout: out, stderr: new StringStream() });
    const parsed = JSON.parse(out.buf) as Array<{ code: string; severity: string }>;
    expect(parsed.some((d) => d.code === "missing_required_parameter")).toBe(true);
  });

  it("validate --warnings-as-errors: clean graph with isolated node returns 1", () => {
    const path = writeJson("isolated.json", {
      version: 1,
      graph: {
        nodes: [{ id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: { value: 1 } }],
        edges: [],
      },
    });
    const out = new StringStream();
    expect(
      main(["validate", path, "--warnings-as-errors"], {
        stdout: out,
        stderr: new StringStream(),
      }),
    ).toBe(1);
  });

  it("compile: clean simple-add legacy graph emits the legacy-shaped runtime JSON to stdout", () => {
    const path = writeJson("clean.json", cleanLegacy());
    const out = new StringStream();
    expect(main(["compile", path], { stdout: out, stderr: new StringStream() })).toBe(0);
    const parsed = JSON.parse(out.buf) as {
      nodes: Array<{ uid: number; type: string; value?: number }>;
      edges: Array<{ src: number; dst: number; port_out: string; port_in: string }>;
    };
    expect(parsed.nodes).toHaveLength(4);
    expect(parsed.nodes[0]).toEqual({ uid: 1, name: "Two", type: "Constant", value: 2 });
    expect(parsed.edges).toHaveLength(3);
  });

  it("compile --out: writes to the requested path", () => {
    const inPath = writeJson("clean.json", cleanLegacy());
    const outPath = join(workdir, "out.json");
    expect(
      main(["compile", inPath, "--out", outPath], {
        stdout: new StringStream(),
        stderr: new StringStream(),
      }),
    ).toBe(0);
    const parsed = JSON.parse(readFileSync(outPath, "utf8")) as { nodes: unknown[] };
    expect(parsed.nodes).toHaveLength(4);
  });

  it("compile: graph with validation errors aborts with code 1", () => {
    const path = writeJson("bad.json", {
      version: 1,
      graph: {
        nodes: [{ id: 1, type: "Constant", position: { x: 0, y: 0 }, parameters: {} }],
        edges: [],
      },
    });
    const err = new StringStream();
    expect(main(["compile", path], { stdout: new StringStream(), stderr: err })).toBe(1);
    expect(err.buf).toMatch(/compile aborted/);
    expect(err.buf).toMatch(/missing_required_parameter/);
  });

  it("roundtrip: legacy input emits a versioned document on stdout", () => {
    const path = writeJson("legacy.json", cleanLegacy());
    const out = new StringStream();
    expect(main(["roundtrip", path], { stdout: out, stderr: new StringStream() })).toBe(0);
    const parsed = JSON.parse(out.buf) as { version: number; graph: { nodes: unknown[] } };
    expect(parsed.version).toBe(1);
    expect(parsed.graph.nodes).toHaveLength(4);
  });

  it("compile: --out missing path argument returns 2", () => {
    const inPath = writeJson("clean.json", cleanLegacy());
    const err = new StringStream();
    expect(
      main(["compile", inPath, "--out"], {
        stdout: new StringStream(),
        stderr: err,
      }),
    ).toBe(2);
    expect(err.buf).toMatch(/--out requires/);
  });
});
