import { expect, test } from "bun:test";
import { parseArgs } from "../src/args.js";

test("no arguments means the write gate stays shut", () => {
  expect(parseArgs([])).toEqual({ args: { allowWrite: false } });
});

test("--allow-write opens the flag half of the gate", () => {
  expect(parseArgs(["--allow-write"])).toEqual({ args: { allowWrite: true } });
});

test("an unrecognised option is a usage error", () => {
  // #121: refused before the transport starts. A server that has already
  // opened stdio cannot report a usage error without corrupting the stream.
  expect(parseArgs(["--nope"])).toEqual({ usage: "visimark-mcp: unknown option --nope" });
});

test("--help and -h ask for the help text, not a usage error", () => {
  for (const flag of ["--help", "-h"]) {
    const r = parseArgs([flag]);
    expect("help" in r && r.help).toContain("usage: visimark-mcp");
  }
});
