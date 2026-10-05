/**
 * Acceptance for a bare `report deltas` with nothing to read
 * (docs/design/a-bare-report-deltas-in-a-sheet-with-no-spec.md §6).
 */
import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../src/cli/main.js";

const FIXTURE = join(import.meta.dir, "fixtures", "simulation", "bare-deltas.md");
const CLEAN = readFileSync(FIXTURE, "utf8");
const MESSAGE =
  "`report deltas` has nothing to read: this sheet has no scalar that is not a param; name the values with `deltas on REF, …`";
const DELTAS =
  "`report deltas` takes: [on REF {, REF}] among feasible|infeasible|all";

async function run(args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCli(args, {
    out: (l: string) => out.push(l),
    err: (l: string) => err.push(l),
  });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

/** run `cmd` on a generated variant written to a temp file named `v.md` */
async function onVariant(md: string, args: string[]) {
  const dir = mkdtempSync(join(tmpdir(), "bare-deltas-"));
  try {
    const path = join(dir, "v.md");
    writeFileSync(path, md);
    const r = await run([...args, path]);
    return { ...r, path };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const readings = (body: string) => CLEAN.replace("report deltas\nreport gates", body);
const typeCount = (out: string) => (out.match(/^\s+TYPE\s/gm) ?? []).length;

test("1. the fixture: one TYPE on the bare deltas line, exit 1", async () => {
  const r = await run(["check", FIXTURE]);
  expect(r.code).toBe(1);
  expect(r.out).toContain(`  TYPE    readings.         ${DELTAS}`);
  expect(r.out).not.toContain("nothing to read");
  expect(r.out).toContain("1 problem (0 stale, 1 error)");
  const j = JSON.parse((await run(["check", "--json", FIXTURE])).out);
  const f = j.files[0].findings;
  expect(f).toHaveLength(1);
  expect(f[0].code).toBe("TYPE");
  expect(f[0].class).toBe("problem");
  expect(f[0].location.sheet).toBe("readings");
  expect(f[0].location.name).toBeUndefined();
  expect(f[0].details.message).toBe(DELTAS);
  expect(j.status).toBe("problems");
  expect(j.files[0].summary.errors).toBe(1);
});

test("2. deltas on plan.revenue is clean", async () => {
  const r = await onVariant(readings("report deltas on plan.revenue among all\nreport gates"), [
    "check",
  ]);
  expect(r.code).toBe(0);
  expect(r.out).toContain("0 problems");
});

test("3. silent cases", async () => {
  for (const body of [
    "margin = 5\nreport deltas among all",
    "rate = 5\nreport deltas among all",
    "report gates",
    "report ledger\nreport forbidden",
  ]) {
    const r = await onVariant(readings(body), ["check"]);
    expect(typeCount(r.out)).toBe(0);
  }
  // an unparseable line may have been the scalar: only its own finding
  const dropped = await onVariant(readings("x = (\nreport deltas"), ["check"]);
  expect(dropped.out).not.toContain("nothing to read");
});

test("4. a sheet whose only scalar is a param is refused", async () => {
  const r = await onVariant(
    readings("param p precision 0 in [1, 3] lattice 1 = default 1\nreport deltas among all"),
    ["check"],
  );
  expect(r.code).toBe(1);
  expect(r.out).toContain(MESSAGE);
});

test("5. an unparsed deltas line does not block the sheet's other reports", async () => {
  const r = await run(["simulate", FIXTURE]);
  expect(r.code).toBe(0);
  expect(r.out).toContain("#readings\n\nreport gates");
  expect(r.out).not.toContain("(cannot start)");
  expect(r.err).not.toContain("cannot start");
  expect(r.err).toContain("1 of 1 sheets ran");
});

test("6. fmt writes nothing", async () => {
  const r = await onVariant(CLEAN, ["fmt"]);
  expect(r.out).toContain("unchanged");
});

test("7. the battery example stays clean", async () => {
  const r = await run([
    "check",
    join(import.meta.dir, "..", "..", "..", "docs", "example-battery-storage.md"),
  ]);
  expect(r.out).toContain("0 problems");
});

test("8. two bare deltas lines are two synopsis TYPEs", async () => {
  const md = CLEAN + "\n```vmark #more\nreport deltas\n```\n";
  const r = await onVariant(md, ["check"]);
  expect(typeCount(r.out)).toBe(2);
  expect(r.out).toContain(DELTAS);
  expect(r.out).not.toContain("nothing to read");
  expect(r.out).not.toMatch(/DUP/);
});

test("9. a duplicate deltas among all is one nothing-to-read TYPE and one DUP", async () => {
  const r = await onVariant(readings("report deltas among all\nreport deltas among all"), ["check"]);
  expect(typeCount(r.out)).toBe(1);
  expect(r.out).toContain(MESSAGE);
  expect(r.out).toMatch(/DUP/);
});
