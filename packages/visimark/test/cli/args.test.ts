import { describe, expect, test } from "bun:test";
import { parseArgs, usageLine } from "../../src/cli/args.js";
import type { CommandName } from "../../src/report/json.js";

const REFUSED: [CommandName, string[], string][] = [
  ["check", ["a.md", "--jsonn"], "visimark: unknown option --jsonn — did you mean `--json`?"],
  ["check", ["a.md", "--format", "yaml"], "visimark: unknown option --format"],
  ["check", ["a.md", "--fix-dates"], "visimark: --fix-dates is only valid with fmt"],
  ["fmt", ["a.md", "--write"], "visimark: --write is only valid with infer"],
  ["check", ["a.md", "--get", "vat"], "visimark: --get is only valid with eval"],
  ["check", ["a.md", "--scenario", "s.json"], "visimark: --scenario is only valid with eval"],
  [
    "check",
    ["a.md", "--json=true"],
    "visimark: unknown option --json=true — `--json` takes no value",
  ],
  ["eval", ["a.md", "--get=vat"], "visimark: unknown option --get=vat — write `--get vat`"],
  ["check", ["a.md", "-j"], "visimark: unknown option -j"],
  [
    "check",
    ["a.md", "--"],
    "visimark: unknown option -- — to name a file that starts with -, write ./-name",
  ],
  ["check", ["a.md", "#lines"], "visimark: #lines is only valid with explain"],
  ["eval", ["a.md", "b.md"], "visimark: eval takes one file"],
  ["explain", ["a.md", "b.md"], "visimark: explain takes one file"],
  ["ref", ["SUM", "MAX"], "visimark: ref takes one name"],
  ["eval", ["a.md", "--get"], "visimark: --get needs a name"],
  ["eval", ["a.md", "--get", ""], "visimark: --get needs a name"],
  ["eval", ["a.md", "--get", "--json"], "visimark: --get needs a name"],
  ["eval", ["a.md", "--scenario"], "visimark: --scenario needs a file, or - for stdin"],
  ["eval", ["a.md", "--scenario", "--json"], "visimark: --scenario needs a file, or - for stdin"],
];

const ACCEPTED: [CommandName, string[]][] = [
  ["check", ["a.md", "b.md", "--json"]],
  ["fmt", ["a.md", "--fix-dates", "--json"]],
  ["infer", ["a.md", "--write"]],
  ["eval", ["a.md", "--get", "vat", "--json"]],
  ["eval", ["a.md", "--scenario", "-"]],
  ["explain", ["a.md", "#lines", "#recon"]],
  ["ref", []],
  ["ref", ["SUM", "--json"]],
];

describe("parseArgs refuses", () => {
  for (const [command, args, message] of REFUSED) {
    test(`${command} ${JSON.stringify(args)}`, () => {
      const r = parseArgs(command, args);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toBe(message);
    });
  }

  test("the first violation in argv order wins", () => {
    const r = parseArgs("eval", ["a.md", "b.md", "--bogus"]);
    expect(!r.ok && r.message).toBe("visimark: eval takes one file");
    const s = parseArgs("check", ["--bogus", "--fix-dates"]);
    expect(!s.ok && s.message).toBe("visimark: unknown option --bogus");
  });

  test("--json is detected by the exact token; --json=true is not it", () => {
    const a = parseArgs("check", ["a.md", "--jsonn", "--json"]);
    expect(!a.ok && a.json).toBe(true);
    const b = parseArgs("check", ["a.md", "--json=true"]);
    expect(!b.ok && b.json).toBe(false);
  });

  test("--help and -h add the command's usage line; other refusals do not", () => {
    for (const flag of ["--help", "-h"]) {
      const r = parseArgs("check", ["a.md", flag]);
      expect(!r.ok && r.message).toBe(`visimark: unknown option ${flag}`);
      expect(!r.ok && r.usage).toBe("usage: visimark check FILE...");
    }
    const ref = parseArgs("ref", ["--help"]);
    expect(!ref.ok && ref.usage).toBe("usage: visimark ref [NAME] [--json]");
    const other = parseArgs("check", ["a.md", "--jsonn"]);
    expect(!other.ok && other.usage).toBeUndefined();
  });
});

describe("parseArgs accepts", () => {
  for (const [command, args] of ACCEPTED) {
    test(`${command} ${JSON.stringify(args)}`, () => {
      expect(parseArgs(command, args).ok).toBe(true);
    });
  }

  test("it returns what the commands read", () => {
    const r = parseArgs("eval", ["a.md", "--get", "vat", "--scenario", "-", "--json"]);
    if (!r.ok) throw new Error(r.message);
    expect(r.parsed.files).toEqual(["a.md"]);
    expect(r.parsed.options.get("get")).toBe("vat");
    expect(r.parsed.options.get("scenario")).toBe("-");
    expect(r.parsed.flags.has("json")).toBe(true);
    const e = parseArgs("explain", ["a.md", "#lines"]);
    if (!e.ok) throw new Error(e.message);
    expect(e.parsed.sheets).toEqual(["lines"]);
  });

  test("a lone - is a file, as today", () => {
    const r = parseArgs("check", ["-"]);
    if (!r.ok) throw new Error(r.message);
    expect(r.parsed.files).toEqual(["-"]);
  });
});

test("usageLine returns the strings the commands print today", () => {
  expect(usageLine("fmt")).toBe("usage: visimark fmt FILE... [--fix-dates] [--no-artifacts]");
  expect(usageLine("eval")).toBe(
    "usage: visimark eval FILE [--scenario FILE|-] [--get NAME] [--json]",
  );
});
