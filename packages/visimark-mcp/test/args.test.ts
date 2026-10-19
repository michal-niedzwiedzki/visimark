import { expect, test } from "bun:test";
import { parseArgs } from "../src/args.js";
import { runServer } from "../src/main.js";

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

test("runServer --help prints the help text and returns 0 without starting the transport", async () => {
  const lines: string[] = [];
  const log = console.log;
  console.log = (l: string) => void lines.push(l);
  try {
    expect(await runServer(["--help"])).toBe(0);
  } finally {
    console.log = log;
  }
  expect(lines.join("\n")).toContain("usage: visimark-mcp");
});

test("--max-questions takes a positive integer", () => {
  expect(parseArgs(["--max-questions", "100"])).toEqual({
    args: { allowWrite: false, maxQuestions: 100 },
  });
  expect(parseArgs(["--allow-write", "--max-questions", "5"])).toEqual({
    args: { allowWrite: true, maxQuestions: 5 },
  });
});

test("--max-questions with no positive integer is a usage error", () => {
  for (const bad of [["0"], ["-1"], ["1.5"], ["abc"], []]) {
    const r = parseArgs(["--max-questions", ...bad]);
    expect("usage" in r && r.usage).toContain("--max-questions needs a positive integer");
  }
});

test("the help text lists --max-questions", () => {
  const r = parseArgs(["-h"]);
  expect("help" in r && r.help).toContain("--max-questions N");
});
