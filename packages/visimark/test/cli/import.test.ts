import { expect, test } from "bun:test";
import { join } from "node:path";
import { runCli } from "../../src/cli/main.js";

const FIXTURE = join(import.meta.dir, "..", "fixtures", "import", "benchmark.md");
const HEADERLESS_FIXTURE = join(
  import.meta.dir,
  "..",
  "fixtures",
  "import",
  "benchmark-headerless.md",
);

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) },
    out: () => out.join("\n"),
  };
}

test("explain --json surfaces the import declaration and stamp state", async () => {
  const c = capture();
  const code = await runCli(["explain", FIXTURE, "--json"], c.io);
  expect(code).toBe(0);
  const j = JSON.parse(c.out()) as {
    sheets: { id: string; import?: { path: string; mode: string | null; stampStatus: string } }[];
  };
  const sheet = j.sheets.find((s) => s.id === "benchmark")!;
  expect(sheet.import?.path).toBe("benchmark.csv");
  expect(sheet.import?.mode).toBe("labelled");
  expect(sheet.import?.stampStatus).toBe("ok");
});

test("explain (plain text) prints the `labelled` keyword for a labelled import", async () => {
  const c = capture();
  const code = await runCli(["explain", FIXTURE], c.io);
  expect(code).toBe(0);
  expect(c.out()).toContain("labelled Id, Time");
});

test("infer proposes nothing for an imported sheet", async () => {
  const c = capture();
  const code = await runCli(["infer", FIXTURE], c.io);
  expect(code).toBe(0);
  expect(c.out()).toContain("0 rules, 0 scalars, 0 anchors");
});

test("explain --json surfaces `mode: unlabelled` for a headerless import", async () => {
  const c = capture();
  const code = await runCli(["explain", HEADERLESS_FIXTURE, "--json"], c.io);
  expect(code).toBe(0);
  const j = JSON.parse(c.out()) as {
    sheets: { id: string; import?: { labels: string[]; mode: string | null } }[];
  };
  const sheet = j.sheets.find((s) => s.id === "benchmark")!;
  expect(sheet.import?.labels).toEqual(["Id", "Time"]);
  expect(sheet.import?.mode).toBe("unlabelled");
});

test("explain (plain text) prints the `unlabelled` keyword for a headerless import", async () => {
  const c = capture();
  const code = await runCli(["explain", HEADERLESS_FIXTURE], c.io);
  expect(code).toBe(0);
  expect(c.out()).toContain("unlabelled Id, Time");
});

test("infer proposes nothing for a headerless imported sheet", async () => {
  const c = capture();
  const code = await runCli(["infer", HEADERLESS_FIXTURE], c.io);
  expect(code).toBe(0);
  expect(c.out()).toContain("0 rules, 0 scalars, 0 anchors");
});
