import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../../src/cli/main.js";

// docs/design/lattice-on-param-and-report-statements-spec.md §5

const DOC = [
  "```vmark #levers",
  "param extra_hours  precision 0 integer in [0, 80] lattice 20 = default 40",
  "param volume_disc  precision 3 in [0%, 10%] lattice 1% = default 0%",
  "param prepay_share precision 2 in { 30%, 40% } = default 30%",
  "```",
  "",
].join("\n");

async function run(args: string[], md: string) {
  const dir = mkdtempSync(join(tmpdir(), "vm-lt-"));
  const file = join(dir, "d.md");
  writeFileSync(file, md);
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCli([...args, file], {
    out: (l: string) => out.push(l),
    err: (l: string) => err.push(l),
  });
  rmSync(dir, { recursive: true });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

test("eval prints the lattice after the domain", async () => {
  const r = await run(["eval"], DOC);
  expect(r.out).toMatch(/levers\.extra_hours\s+integer in \[0, 80\] lattice 20\n/);
  expect(r.out).toMatch(/levers\.volume_disc\s+\[0%, 10%\] lattice 1%\n/);
  expect(r.out).toMatch(/levers\.prepay_share\s+\{ 30%, 40% \}(?:\n|$)/);
});

test("eval --json carries a lattice sibling of domain, absent when none", async () => {
  const j = JSON.parse((await run(["eval", "--json"], DOC)).out);
  expect(j.params["levers.extra_hours"].lattice).toEqual({ step: "20" });
  expect(j.params["levers.volume_disc"].lattice).toEqual({ step: "0.01" });
  expect("lattice" in j.params["levers.prepay_share"]).toBe(false);
  expect(j.params["levers.extra_hours"].domain.clauses).toEqual(["integer", "[0, 80]"]);
});

test("explain prints the lattice after the domain on the param's row", async () => {
  const r = await run(["explain"], DOC);
  expect(r.out).toMatch(
    /extra_hours\s+precision 0\s+default 40\s+domain integer in \[0, 80\]   lattice 20/,
  );
  expect(r.out).not.toMatch(/prepay_share.*lattice/);
});

test("explain --json carries the lattice on the param entry", async () => {
  const j = JSON.parse((await run(["explain", "--json"], DOC)).out);
  const sheet = j.sheets.find((s: { id: string }) => s.id === "levers");
  const byName = Object.fromEntries(sheet.params.map((p: { name: string }) => [p.name, p]));
  expect(byName.volume_disc.lattice).toEqual({ step: "0.01" });
  expect("lattice" in byName.prepay_share).toBe(false);
});

test("a document with no lattice prints no lattice anywhere", async () => {
  const plain = DOC.replace(/ lattice [0-9.]+%?/g, "");
  for (const args of [["eval"], ["eval", "--json"], ["explain"], ["explain", "--json"]]) {
    expect((await run(args, plain)).out).not.toContain("lattice");
  }
});
