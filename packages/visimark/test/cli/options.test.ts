import { afterAll, describe, expect, test } from "bun:test";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../../src/cli/main.js";

// docs/design/refuse-unrecognised-and-misplaced-cli-options-spec.md §4

const here = dirname(fileURLToPath(import.meta.url));
const docs = join(here, "..", "..", "..", "..", "docs");
const invoice = join(docs, "example-invoice.md");
const version = JSON.parse(readFileSync(join(here, "..", "..", "package.json"), "utf8"))
  .version as string;

const tmp = mkdtempSync(join(tmpdir(), "vm-options-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function copyOf(name: string, from: string): string {
  const p = join(tmp, name);
  copyFileSync(from, p);
  return p;
}

const drift = copyOf("drift.md", join(docs, "example-invoice-drift.md"));

async function run(args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCli(args, {
    out: (l) => out.push(l),
    err: (l) => err.push(l),
  });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

const DID_YOU_MEAN = "visimark: unknown option --jsonn — did you mean `--json`?";

const REFUSED: [string, string[], string][] = [
  ["unknown, close", ["check", invoice, "--jsonn"], DID_YOU_MEAN],
  [
    "fix-dates on check",
    ["check", drift, "--fix-dates"],
    "visimark: --fix-dates is only valid with fmt",
  ],
  ["write on fmt", ["fmt", invoice, "--write"], "visimark: --write is only valid with infer"],
  ["get on check", ["check", invoice, "--get", "vat"], "visimark: --get is only valid with eval"],
  [
    "scenario on check",
    ["check", invoice, "--scenario", "s.json"],
    "visimark: --scenario is only valid with eval",
  ],
  [
    "unknown, no guess",
    ["check", invoice, "--format", "yaml"],
    "visimark: unknown option --format",
  ],
  ["unknown on fmt", ["fmt", drift, "--bogus"], "visimark: unknown option --bogus"],
  ["missing file", ["check", join(tmp, "missing.md"), "--jsonn"], DID_YOU_MEAN],
  ["no file", ["check", "--jsonn"], DID_YOU_MEAN],
  [
    "= on a flag",
    ["check", invoice, "--json=true"],
    "visimark: unknown option --json=true — `--json` takes no value",
  ],
  [
    "= on a value option",
    ["eval", invoice, "--get=vat"],
    "visimark: unknown option --get=vat — write `--get vat`",
  ],
  ["single dash", ["check", invoice, "-j"], "visimark: unknown option -j"],
  [
    "double dash",
    ["check", invoice, "--"],
    "visimark: unknown option -- — to name a file that starts with -, write ./-name",
  ],
  [
    "help",
    ["check", invoice, "--help"],
    "visimark: unknown option --help\nusage: visimark check FILE...",
  ],
  [
    "ref help",
    ["ref", "--help"],
    "visimark: unknown option --help\nusage: visimark ref [NAME] [--json]",
  ],
  [
    "sheet off explain",
    ["check", invoice, "#lines"],
    "visimark: #lines is only valid with explain",
  ],
  ["second file to eval", ["eval", invoice, drift], "visimark: eval takes one file"],
  ["second file to explain", ["explain", invoice, drift], "visimark: explain takes one file"],
  ["second name to ref", ["ref", "SUM", "MAX"], "visimark: ref takes one name"],
  ["ref unknown", ["ref", "SUM", "--jsonn"], DID_YOU_MEAN],
  ["get, no value", ["eval", invoice, "--get"], "visimark: --get needs a name"],
  [
    "scenario, no value",
    ["eval", invoice, "--scenario"],
    "visimark: --scenario needs a file, or - for stdin",
  ],
];

describe("a refused invocation", () => {
  for (const [name, args, stderr] of REFUSED) {
    test(name, async () => {
      const r = await run(args);
      expect(r.code).toBe(2);
      expect(r.out).toBe("");
      expect(r.err).toBe(stderr);
    });
  }
});

describe("under --json a refusal is a USAGE envelope", () => {
  const cases: [string[], string, string][] = [
    [["check", invoice, "--jsonn", "--json"], "check", DID_YOU_MEAN],
    [["eval", invoice, "--get", "--json"], "eval", "visimark: --get needs a name"],
    [["ref", "SUM", "--jsonn", "--json"], "ref", DID_YOU_MEAN],
    [
      ["eval", invoice, "--scenario", "--json"],
      "eval",
      "visimark: --scenario needs a file, or - for stdin",
    ],
    [
      ["check", invoice, "--scenario", "s.json", "--json"],
      "check",
      "visimark: --scenario is only valid with eval",
    ],
  ];
  for (const [args, command, message] of cases) {
    test(args.join(" ").replaceAll(docs, "docs"), async () => {
      const r = await run(args);
      expect(r.code).toBe(2);
      expect(r.err).toBe(message);
      expect(JSON.parse(r.out)).toEqual({
        command,
        visimark: version,
        status: "error",
        error: { code: "USAGE", message },
      });
    });
  }

  test("--json=true is not --json: stderr only", async () => {
    const r = await run(["check", invoice, "--json=true"]);
    expect(r.code).toBe(2);
    expect(r.out).toBe("");
  });
});

describe("a refusal touches nothing", () => {
  for (const args of [["--bogus"], ["--write", "--fix-dates"], ["--fix-dates", "--bogus"]]) {
    test(`fmt <drift> ${args.join(" ")}`, async () => {
      const copy = copyOf("atomic.md", join(docs, "example-invoice-drift.md"));
      const before = readFileSync(copy, "utf8");
      const r = await run(["fmt", copy, ...args]);
      expect(r.code).toBe(2);
      expect(readFileSync(copy, "utf8")).toBe(before);
    });
  }
});

describe("a correct invocation is unchanged", () => {
  test("check --json", async () => {
    const r = await run(["check", invoice, "--json"]);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out).status).toBe("ok");
  });

  test("infer --write on a document with nothing to add", async () => {
    const copy = copyOf("infer.md", invoice);
    expect((await run(["infer", copy, "--write"])).code).toBe(0);
  });

  test("eval --get NAME --json", async () => {
    const r = await run(["eval", invoice, "--get", "vat", "--json"]);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out).values).toEqual({ vat: "0.23" });
  });

  test("explain with a #sheet", async () => {
    const r = await run(["explain", invoice, "#lines"]);
    expect(r.code).toBe(0);
    expect(r.err).toBe("");
  });

  test("fmt --fix-dates exits as fmt does without it", async () => {
    const a = copyOf("a.md", join(docs, "example-invoice-drift.md"));
    const b = copyOf("b.md", join(docs, "example-invoice-drift.md"));
    expect((await run(["fmt", a, "--fix-dates"])).code).toBe((await run(["fmt", b])).code);
  });

  test("command-position --version and an unknown command", async () => {
    expect(await run(["--version"])).toEqual({ code: 0, out: `visimark ${version}`, err: "" });
    const r = await run(["nope"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("unknown command `nope`");
  });
});
