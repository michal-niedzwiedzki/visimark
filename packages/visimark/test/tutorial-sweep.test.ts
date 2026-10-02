/**
 * Chapter 31 of the tutorial quotes a `simulate` session on
 * `docs/tutorial/runway-sweep.md`. This test holds the quoted text to the
 * tool's output byte for byte (docs/design/add-a-simulate-command-spec.md §8).
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { runCli } from "../src/cli/main.js";

const DOCS = join(import.meta.dir, "..", "..", "..", "docs");
const MODEL = join(DOCS, "tutorial", "runway-sweep.md");
const PROMPT = "$ visimark simulate runway-sweep.md";

function quoted(md: string): string[] {
  const lines = md.split("\n");
  const start = lines.indexOf(PROMPT);
  expect(start).toBeGreaterThan(0);
  expect(lines[start - 1]).toBe("```console");
  const end = lines.indexOf("```", start);
  return lines.slice(start + 1, end);
}

test("chapter 31's simulate transcript is the tool's output", async () => {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCli(["simulate", MODEL], {
    out: (l) => out.push(l),
    err: (l) => err.push(l),
    errTTY: false,
  });
  expect(code).toBe(0);
  const local = (l: string): string => l.split(`${dirname(MODEL)}/`).join("");
  const session = [err[0]!, ...out.flatMap((l) => l.split("\n")), err[1]!].map(local);
  expect(quoted(readFileSync(join(DOCS, "tutorial.md"), "utf8"))).toEqual(session);
});

test("runway-sweep.md checks clean", async () => {
  expect(await runCli(["check", MODEL], { out: () => {}, err: () => {} })).toBe(0);
});
