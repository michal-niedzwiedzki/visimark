import { expect, test, describe } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../../src/cli/main.js";
import { cleanPath, strippedClean } from "../examples.js";

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) },
    out: () => out.join("\n"),
    err: () => err.join("\n"),
  };
}

const scratch = (name: string, body: string): string => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-infer-"));
  const path = join(dir, name);
  writeFileSync(path, body);
  return path;
};

describe("infer is advisory: it never exits 1", () => {
  test("a document with rules to propose exits 0", async () => {
    const c = capture();
    expect(await runCli(["infer", scratch("a.md", strippedClean)], c.io)).toBe(0);
    expect(c.out()).toContain("Net    = Qty * Rate");
    expect(c.out()).toContain("4 rules, 4 scalars, 4 anchors.");
  });

  test("a document with nothing to propose is not a failure", async () => {
    const c = capture();
    const code = await runCli(["infer", scratch("b.md", "# Nothing here\n")], c.io);
    expect(code).toBe(0);
    expect(c.out()).toContain("0 rules, 0 scalars, 0 anchors.");
  });

  test("a document that already has its rules proposes none of them again", async () => {
    const c = capture();
    expect(await runCli(["infer", cleanPath], c.io)).toBe(0);
    expect(c.out()).not.toContain("Net = Qty * Rate");
  });

  test("no files is a usage error", async () => {
    const c = capture();
    expect(await runCli(["infer"], c.io)).toBe(2);
    expect(c.err()).toContain("usage: visimark infer");
  });

  test("an unreadable file exits 2", async () => {
    const c = capture();
    expect(await runCli(["infer", "/nope/missing.md"], c.io)).toBe(2);
    expect(c.err()).toContain("cannot read");
  });
});

describe("--write", () => {
  test("inserts the blocks and anchors, and check is then green", async () => {
    const path = scratch("c.md", strippedClean);
    const c = capture();
    expect(await runCli(["infer", path, "--write"], c.io)).toBe(0);
    expect(c.out()).toContain(`${path}: wrote 2 blocks, 4 anchors`);
    expect(readFileSync(path, "utf8")).toContain("```vmark #unnamed1");

    const after = capture();
    expect(await runCli(["check", path], after.io)).toBe(0);
    expect(after.out()).toContain("0 problems");
  });

  test("is idempotent — a second run has nothing left to write", async () => {
    const path = scratch("d.md", strippedClean);
    await runCli(["infer", path, "--write"], capture().io);
    const once = readFileSync(path, "utf8");
    const c = capture();
    await runCli(["infer", path, "--write"], c.io);
    expect(readFileSync(path, "utf8")).toBe(once);
    expect(c.out()).toContain("nothing to write");
  });

  test("without it, the file is untouched", async () => {
    const path = scratch("e.md", strippedClean);
    await runCli(["infer", path], capture().io);
    expect(readFileSync(path, "utf8")).toBe(strippedClean);
  });
});

describe("check points at infer when a table has no rules", () => {
  test("a rules-free document fails, and the failure names the way out", async () => {
    const path = scratch("f.md", strippedClean);
    const c = capture();
    expect(await runCli(["check", path], c.io)).toBe(1);
    expect(c.out()).toContain("COVERAGE");
    expect(c.out()).toContain("visimark infer");
  });

  test("a document that already has rules is left alone", async () => {
    const c = capture();
    expect(await runCli(["check", cleanPath], c.io)).toBe(0);
    expect(c.out()).not.toContain("COVERAGE");
  });

  test("a table infer can make nothing of fails too — the marker is the way out", async () => {
    // One row is not evidence of a rule, so `infer` has nothing to propose.
    // The document still has to say out loud that it has nothing to derive.
    const path = scratch("g.md", "| Item | Price |\n|------|------:|\n| pen  |  5.00 |\n");
    const c = capture();
    expect(await runCli(["check", path], c.io)).toBe(1);
    expect(c.out()).toContain("no-formulas");
  });

  test("marking it is what makes it pass", async () => {
    const path = scratch("h.md", "| Item | Price |\n|------|------:|\n| pen  |  5.00 |\n");
    await runCli(["infer", path, "--write"], capture().io);
    const c = capture();
    expect(await runCli(["check", path], c.io)).toBe(0);
  });
});

test("the usage text lists infer", async () => {
  const c = capture();
  await runCli(["--help"], c.io);
  expect(c.out()).toContain("visimark infer FILE... [--write]");
});
