import { expect, test } from "bun:test";
import { join } from "node:path";
import { runCli } from "../../src/cli/main.js";

const FIXTURE = join(import.meta.dir, "..", "fixtures", "import", "benchmark.md");

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
    sheets: { id: string; import?: { path: string; stampStatus: string } }[];
  };
  const sheet = j.sheets.find((s) => s.id === "benchmark")!;
  expect(sheet.import?.path).toBe("benchmark.csv");
  expect(sheet.import?.stampStatus).toBe("ok");
});

test("infer proposes nothing for an imported sheet", async () => {
  const c = capture();
  const code = await runCli(["infer", FIXTURE], c.io);
  expect(code).toBe(0);
  expect(c.out()).toContain("0 rules, 0 scalars, 0 anchors");
});
