import { expect, test } from "bun:test";
import { sweep, type CheckNote, type SweepSource } from "../src/sweep.js";

/**
 * The host-free sweep (#384 spec §2.1): the walk, the prefilter, the yields
 * and the verdict rules, over a per-note checker the host supplies. The
 * Obsidian plugin's `sweep.test.ts` runs the same loop with its real checker
 * over manual test §2.8's fixture; this one uses a stub, so it pins only
 * what the loop itself decides.
 */

const block = (body: string): string => "```vmark #t\n" + body + "\n```\n";

/** one problem per `STALE`, one piece of advice per `WARN`, detail = path */
const stub: CheckNote<string> = (text, path) =>
  Promise.resolve({
    problems: text.split("STALE").length - 1,
    advice: text.split("WARN").length - 1,
    detail: path,
  });

function source(entries: Record<string, string | null>, lazy = false): SweepSource {
  const paths = Object.keys(entries);
  return {
    paths: () => (lazy ? Promise.resolve(paths) : paths),
    read: (p) => Promise.resolve(entries[p] ?? null),
  };
}

const fixture: Record<string, string | null> = {
  "plain.md": "# no block here\n",
  "mentions.md": "a `vmark` mention, no fence\n",
  "clean.md": block("x = 1"),
  "stale.md": block("x = 1 # STALE STALE"),
  "advice.md": block("x = 1 # WARN"),
  "gone.md": null,
};

test("lists the notes with problems, with the checker's detail", async () => {
  const r = await sweep(source(fixture), stub);
  expect(r.notes).toEqual([{ path: "stale.md", problems: 2, advice: 0, detail: "stale.md" }]);
});

test("the prefilter and the block check run before the checker", async () => {
  const seen: string[] = [];
  const r = await sweep(source(fixture), (text, path) => (seen.push(path), stub(text, path)));
  expect(r.scanned).toBe(6);
  expect(r.candidates).toBe(4);
  expect(r.checked).toBe(3);
  expect(seen.sort()).toEqual(["advice.md", "clean.md", "stale.md"]);
});

test("advice alone never lists a note, and is counted", async () => {
  const r = await sweep(source(fixture), stub);
  expect(r.adviceOnly).toEqual(["advice.md"]);
});

test("a null read and a checker throw both land in unreadable", async () => {
  const r = await sweep(source(fixture), (text, path) =>
    path === "clean.md" ? Promise.reject(new Error("boom")) : stub(text, path),
  );
  // in source order: clean.md is read and then throws, gone.md cannot be read
  expect(r.unreadable).toEqual(["clean.md", "gone.md"]);
});

test("paths() may be a promise, with the same result as the array form", async () => {
  const eager = await sweep(source(fixture), stub);
  const lazy = await sweep(source(fixture, true), stub);
  expect(lazy).toEqual(eager);
});

test("progress ends at the total when paths() is a promise", async () => {
  const seen: [number, number][] = [];
  await sweep(source(fixture, true), stub, { chunk: 2, onProgress: (d, t) => seen.push([d, t]) });
  expect(seen.at(-1)).toEqual([6, 6]);
});

test("cancelling stops early and says so", async () => {
  const signal = { aborted: false };
  const r = await sweep(source(fixture), stub, {
    chunk: 1,
    signal,
    pause: () => ((signal.aborted = true), Promise.resolve()),
  });
  expect(r.cancelled).toBe(true);
  expect(r.scanned).toBeLessThan(6);
});
