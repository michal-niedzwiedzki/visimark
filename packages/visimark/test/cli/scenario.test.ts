import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../../src/cli/main.js";

// docs/design/scenario-params-spec.md §5.3 and §6

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..");
const mainTs = join(repoRoot, "packages", "visimark", "src", "cli", "main.ts");
const example = join(repoRoot, "docs", "example-agent-budget.md");
const charts = join(repoRoot, "docs", "example-charts.md");
const fixtures = join(here, "..", "fixtures", "scenario");
const tight = join(fixtures, "tight.json");

const tmp = mkdtempSync(join(tmpdir(), "vm-scenario-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function scenario(name: string, json: string): string {
  const p = join(tmp, name);
  writeFileSync(p, json);
  return p;
}

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) },
    out: () => out.join("\n"),
    err: () => err.join("\n"),
  };
}

async function run(args: string[]) {
  const c = capture();
  const code = await runCli(args, c.io);
  return { code, out: c.out(), err: c.err() };
}

describe("the motivating document", () => {
  test("checks clean with its param on the default", async () => {
    const r = await run(["check", example]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("0 problems");
  });

  test("plain eval prints the defaults' values", async () => {
    const r = await run(["eval", example]);
    expect(r.code).toBe(0);
    expect(r.out).toBe(
      [
        "rates.budget     2",
        "calls.spent      0.4266",
        "calls.remaining  1.5734",
        "calls.Cost       0.1268, 0.0196, 0.0543, 0.0279, 0.198",
      ].join("\n"),
    );
  });

  test("a tight budget breaks the cap under the scenario, not on the defaults", async () => {
    const r = await run(["eval", "--scenario", tight, example]);
    expect(r.code).toBe(1);
    expect(r.out).toBe(
      [
        "rates.budget     0.4",
        "calls.spent      0.4266",
        "calls.remaining  -0.0266",
        "calls.Cost       0.1268, 0.0196, 0.0543, 0.0279, 0.198",
        `scenario: ${tight}`,
        "  rates.budget  0.4  scenario  (default 2)",
      ].join("\n"),
    );
    expect(r.err).toBe(
      [
        "  ASSERT  #calls   spent <= rates.budget",
        "          0.4266 <= 0.40   is false under scenario (holds on defaults)",
      ].join("\n"),
    );
  });

  test("the same run under --json", async () => {
    const r = await run(["eval", "--scenario", tight, example, "--json"]);
    expect(r.code).toBe(1);
    const doc = JSON.parse(r.out);
    expect(Object.keys(doc)).toEqual([
      "command",
      "visimark",
      "status",
      "file",
      "scenario",
      "values",
      "assertions",
      "charts",
    ]);
    expect(doc.status).toBe("problems");
    expect(doc.values["rates.budget"]).toBe("0.4");
    expect(doc.scenario).toEqual({
      file: tight,
      params: { "rates.budget": { value: "0.4", default: "2", source: "scenario" } },
    });
    expect(doc.assertions[0]).toMatchObject({
      holds: false,
      substituted: "0.4266 <= 0.40",
      defaults: "pass",
    });
  });

  test("a roomier budget passes", async () => {
    const r = await run([
      "eval",
      "--scenario",
      scenario("roomy.json", '{"budget": "1.00"}'),
      example,
    ]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("calls.remaining  0.5734");
    expect(r.err).toBe("");
  });

  test("an unmentioned param keeps its default, and {} equals the defaults", async () => {
    const r = await run(["eval", "--scenario", scenario("empty.json", "{}"), example, "--json"]);
    const doc = JSON.parse(r.out);
    expect(doc.scenario.params["rates.budget"]).toEqual({
      value: "2",
      default: "2",
      source: "default",
    });
    const plain = JSON.parse((await run(["eval", example, "--json"])).out);
    expect(doc.values).toEqual(plain.values);
    const text = await run(["eval", "--scenario", scenario("empty2.json", "{}"), example]);
    expect(text.out.split("\n").slice(-1)[0]).toBe("  rates.budget  2  default");
  });

  test("a too-wide value and a JSON number are SCENARIO errors", async () => {
    for (const [json, message] of [
      [
        '{"budget": "0.405"}',
        "visimark: scenario value for budget has 3 decimals; budget declares 2",
      ],
      ['{"budget": 1}', 'visimark: scenario value for budget must be a string: write "1"'],
    ] as const) {
      const r = await run(["eval", "--scenario", scenario("bad.json", json), example, "--json"]);
      expect(r.code).toBe(2);
      expect(r.err).toBe(message);
      const doc = JSON.parse(r.out);
      expect(doc.status).toBe("error");
      expect(doc.error).toEqual({ code: "SCENARIO", message });
      expect(doc.values).toBeUndefined();
    }
  });

  test("fmt, eval --scenario, check: the document is untouched and stays clean", async () => {
    const copy = join(tmp, "budget.md");
    writeFileSync(copy, readFileSync(example, "utf8"));
    await run(["fmt", copy]);
    const before = readFileSync(copy, "utf8");
    await run(["eval", "--scenario", tight, copy]);
    expect(readFileSync(copy, "utf8")).toBe(before);
    expect((await run(["check", copy])).code).toBe(0);
    expect(before).toBe(readFileSync(example, "utf8"));
  });
});

describe("--scenario plumbing", () => {
  test("no value is a usage error", async () => {
    for (const args of [
      ["eval", example, "--scenario"],
      ["eval", example, "--scenario", "--json"],
    ]) {
      const r = await run(args);
      expect(r.code).toBe(2);
      expect(r.err).toBe("visimark: --scenario needs a file, or - for stdin");
    }
  });

  test("an unreadable file", async () => {
    const r = await run(["eval", "--scenario", join(tmp, "missing.json"), example]);
    expect(r.code).toBe(2);
    expect(r.err).toBe(`visimark: cannot read scenario ${join(tmp, "missing.json")}`);
    expect(r.out).toBe("");
  });

  test("not a JSON object", async () => {
    const p = scenario("list.json", "[1]");
    const r = await run(["eval", "--scenario", p, example]);
    expect(r.code).toBe(2);
    expect(r.err).toBe(`visimark: scenario ${p} is not a JSON object`);
  });

  test("--scenario - reads stdin", async () => {
    const proc = Bun.spawn(["bun", mainTs, "eval", "--scenario", "-", example], {
      cwd: repoRoot,
      stdin: new TextEncoder().encode('{"budget": "0.40"}'),
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = await new Response(proc.stdout).text();
    expect(await proc.exited).toBe(1);
    expect(out).toContain("scenario: -\n  rates.budget  0.4  scenario  (default 2)");
  });

  test("--get prints one bare value and no scenario block", async () => {
    const r = await run(["eval", "--scenario", tight, example, "--get", "calls.remaining"]);
    expect(r.code).toBe(1);
    expect(r.out).toBe("-0.0266");
    const j = JSON.parse(
      (await run(["eval", "--scenario", tight, example, "--get", "calls.remaining", "--json"])).out,
    );
    expect(j.values).toEqual({ "calls.remaining": "-0.0266" });
    expect(j.scenario.params["rates.budget"].source).toBe("scenario");
  });

  for (const command of ["check", "fmt", "infer", "explain"]) {
    test(`${command} refuses --scenario and leaves the file alone`, async () => {
      const copy = join(tmp, `${command}.md`);
      writeFileSync(copy, readFileSync(example, "utf8"));
      const before = readFileSync(copy, "utf8");
      const r = await run([command, copy, "--scenario", tight]);
      expect(r.code).toBe(2);
      expect(r.err).toBe("visimark: --scenario is only valid with eval");
      expect(r.out).toBe("");
      expect(readFileSync(copy, "utf8")).toBe(before);
      const j = await run([command, copy, "--scenario", tight, "--json", "--write"]);
      expect(JSON.parse(j.out).error).toEqual({
        code: "SCENARIO",
        message: "visimark: --scenario is only valid with eval",
      });
      expect(readFileSync(copy, "utf8")).toBe(before);
    });
  }

  test("ref refuses --scenario", async () => {
    const r = await run(["ref", "SUM", "--scenario", tight]);
    expect(r.code).toBe(2);
    expect(r.err).toBe("visimark: --scenario is only valid with eval");
  });

  test("plain eval output is unchanged by the feature", async () => {
    const r = await run(["eval", charts, "--json"]);
    expect(JSON.parse(r.out).scenario).toBeUndefined();
    expect(JSON.parse(r.out).charts[0].state).toBeDefined();
  });
});

describe("assertions and charts under a scenario", () => {
  const doc = join(tmp, "asserts.md");
  writeFileSync(
    doc,
    [
      "| Month | Revenue |",
      "|-------|--------:|",
      "| Jan   | 10      |",
      "| Feb   | 20      |",
      "",
      "```vmark #s",
      "param cap precision 0 = default 100",
      "param floor precision 0 = default 1",
      "total = SUM(Revenue)",
      "root precision 2 = SQRT(floor)",
      "assert total <= cap",
      "assert total >= floor * 100",
      "assert root > 0",
      "chart c as bar of Revenue labelled Month",
      "```",
      "",
    ].join("\n"),
  );

  test("defaults is pass, fail or unverified, and only on false entries", async () => {
    // cap 10 breaks the first only under the scenario; the second is false on
    // the defaults too; the third holds either way
    const s = scenario("a.json", '{"cap": "10"}');
    const r = await run(["eval", "--scenario", s, doc, "--json"]);
    const a = JSON.parse(r.out).assertions;
    expect(a[0]).toMatchObject({ holds: false, defaults: "pass" });
    expect(a[1]).toMatchObject({ holds: false, defaults: "fail" });
    expect(a[2].holds).toBe(true);
    expect(a[2].defaults).toBeUndefined();
    const text = await run(["eval", "--scenario", s, doc]);
    expect(text.err).toContain("is false under scenario (holds on defaults)");
    expect(text.err).toContain("is false under scenario (also false on defaults)");
    const plain = JSON.parse((await run(["eval", doc, "--json"])).out).assertions;
    for (const e of plain) expect(e.defaults).toBeUndefined();
  });

  test("an assertion the defaults cannot evaluate is unverified", async () => {
    const d = join(tmp, "unverified.md");
    writeFileSync(
      d,
      "```vmark #s\nparam x precision 0 = default -4\nr precision 2 = SQRT(x)\nassert r > 5\n```\n",
    );
    const r = await run(["eval", "--scenario", scenario("u.json", '{"x": "4"}'), d, "--json"]);
    expect(JSON.parse(r.out).assertions[0]).toMatchObject({ holds: false, defaults: "unverified" });
  });

  test("a scenario that makes a value unevaluable leaves it out, as plain eval does", async () => {
    const r = await run([
      "eval",
      "--scenario",
      scenario("neg.json", '{"floor": "-1"}'),
      doc,
      "--json",
    ]);
    const j = JSON.parse(r.out);
    expect(j.values["s.root"]).toBeUndefined();
    expect(j.assertions[2].holds).toBeNull();
  });

  test("chart entries carry no state under a scenario", async () => {
    const r = await run(["eval", "--scenario", scenario("c.json", "{}"), doc, "--json"]);
    const c = JSON.parse(r.out).charts[0];
    expect(c.series).toBeDefined();
    expect("state" in c).toBe(false);
  });
});

describe("explain", () => {
  test("lists params apart from scalars, with width and default as written", async () => {
    const r = await run(["explain", example, "#rates"]);
    expect(r.out).toContain(
      "  params:\n    budget   precision 2   default 2.00\n  order:   budget",
    );
    expect(r.out).not.toContain("scalars:");
    const j = JSON.parse((await run(["explain", example, "--json"])).out);
    expect(j.sheets[0].params).toEqual([{ name: "budget", precision: 2, default: "2.00" }]);
    expect(j.sheets[0].scalars).toEqual([]);
  });

  test("document-scope params", async () => {
    const d = join(tmp, "docscope.md");
    writeFileSync(
      d,
      "```vmark\nparam rate precision 3 = default 19%\nx precision 2 = rate * 2\n```\n",
    );
    const r = await run(["explain", d]);
    expect(r.out).toContain(
      "document scope\n  x = rate * 2\n  params:\n    rate   precision 3   default 19%",
    );
    const j = JSON.parse((await run(["explain", d, "--json"])).out);
    expect(j.documentScope).toEqual([{ name: "x", rule: "rate * 2" }]);
    expect(j.documentScopeParams).toEqual([{ name: "rate", precision: 3, default: "19%" }]);
    const e = await run(["eval", "--scenario", scenario("d.json", '{"rate": "10%"}'), d]);
    expect(e.out).toContain("x     0.2");
    expect(e.out).toContain("  rate  0.1  scenario  (default 0.19)");
  });
});
