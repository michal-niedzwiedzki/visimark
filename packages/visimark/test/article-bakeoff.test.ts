/**
 * The bakeoff article quotes two `simulate` sessions: one on the price-only model
 * Ted writes first (test/fixtures/bakeoff-price-only/bakeoff.md), one on
 * `docs/articles/bakeoff/bakeoff.md`. This test holds the quoted text to the
 * tool's output byte for byte, as `tutorial-sweep.test.ts` does for chapter 31.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { runCli } from "../src/cli/main.js";

const DIR = join(import.meta.dir, "..", "..", "..", "docs", "articles", "bakeoff");
const MODEL = join(DIR, "bakeoff.md");
const EARLY = join(import.meta.dir, "fixtures", "bakeoff-price-only", "bakeoff.md");
const ARTICLE = join(DIR, "manda-panda-and-the-bakeoff.md");
const PROMPT = "$ visimark simulate bakeoff.md";
/** the elapsed time on a summary line is wall time, so neither side compares it */
const UNTIMED = / in (\d+ ms|\d+\.\d s|\d+ min \d\d s)$/;

function quoted(md: string, nth: number): string[] {
  const lines = md.split("\n");
  const starts = lines.flatMap((l, i) => (l === PROMPT ? [i] : []));
  const start = starts[nth]!;
  expect(start).toBeGreaterThan(0);
  expect(lines[start - 1]).toBe("```console");
  const end = lines.indexOf("```", start);
  return lines.slice(start + 1, end);
}

async function session(model: string): Promise<string[]> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCli(["simulate", model], {
    out: (l) => out.push(l),
    err: (l) => err.push(l),
    errTTY: false,
  });
  expect(code).toBe(0);
  const local = (l: string): string =>
    l
      .split(`${dirname(model)}/`)
      .join("")
      .replace(UNTIMED, "");
  return [err[0]!, ...out.flatMap((l) => l.split("\n")), err[1]!].map(local);
}

function article(nth: number): string[] {
  return quoted(readFileSync(ARTICLE, "utf8"), nth).map((l) => l.replace(UNTIMED, ""));
}

test("the price-only transcript is the tool's output on the early model", async () => {
  expect(article(0)).toEqual(await session(EARLY));
});

test("the article's final simulate transcript is the tool's output", async () => {
  expect(article(1)).toEqual(await session(MODEL));
});

test("bakeoff.md and the early model check without errors", async () => {
  for (const model of [MODEL, EARLY]) {
    expect(await runCli(["check", model], { out: () => {}, err: () => {} })).toBe(0);
  }
});
