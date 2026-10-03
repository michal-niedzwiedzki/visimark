/**
 * The battery storage showcase quotes its own `simulate` transcript
 * (docs/design/add-a-simulate-command-spec.md §5 item 4 and §7.1). This test
 * runs the command and holds the quoted text to it byte for byte, so the
 * example cannot drift from the tool. The ledger section is quoted in a second
 * block, inside `<details>`; the two blocks together are the whole session.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { runCli } from "../src/cli/main.js";

const DOC = join(import.meta.dir, "..", "..", "..", "docs", "example-battery-storage.md");
const NAME = "example-battery-storage.md";
const PROMPT = `$ visimark simulate ${NAME}`;
/** the elapsed time on a summary line is wall time, so neither side compares it */
const UNTIMED = / in (\d+ ms|\d+\.\d s|\d+ min \d\d s)$/;

function consoleBlocks(md: string): string[][] {
  const blocks: string[][] = [];
  let cur: string[] | null = null;
  for (const line of md.split("\n")) {
    if (cur === null && line === "```console") cur = [];
    else if (cur !== null && line === "```") {
      blocks.push(cur);
      cur = null;
    } else if (cur !== null) cur.push(line);
  }
  return blocks;
}

test("check is clean", async () => {
  const code = await runCli(["check", DOC], { out: () => {}, err: () => {} });
  expect(code).toBe(0);
});

test(
  "the quoted simulate transcript is the tool's output",
  async () => {
    const blocks = consoleBlocks(readFileSync(DOC, "utf8"));
    const a = blocks.find((b) => b[0] === PROMPT);
    const b = blocks.find((x) => x[0] === "#ledger");
    expect(a).toBeDefined();
    expect(b).toBeDefined();

    const out: string[] = [];
    const err: string[] = [];
    const code = await runCli(["simulate", DOC], {
      out: (l) => out.push(l),
      err: (l) => err.push(l),
      errTTY: false,
    });
    expect(code).toBe(0);
    const local = (l: string): string =>
      l
        .split(`${dirname(DOC)}/`)
        .join("")
        .replace(UNTIMED, "");
    const session = [err[0]!, ...out.flatMap((l) => l.split("\n")), err[1]!].map(local);
    expect(err.length).toBe(2);
    expect([...a!.slice(1), ...b!].map((l) => l.replace(UNTIMED, ""))).toEqual(session);
  },
  { timeout: 180_000 },
);
