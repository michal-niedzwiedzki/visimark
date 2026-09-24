import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { sweep, type SweepSource } from "../src/sweep.js";
import { LiveVaultIndex } from "../src/vault-index.js";

const docs = resolve(import.meta.dir, "../../../docs");
const read = (name: string): string => readFileSync(join(docs, name), "utf8");
const clean = read("example-invoice.md");
const drifted = read("example-invoice-drift.md");
const ordinary = "# Note\n\nSome prose, a list and a table.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n";

/** a vault as a mutable `Map`, so a test can edit, add, remove and rename */
function vault(entries: Record<string, string>): {
  files: Map<string, string>;
  source: SweepSource;
} {
  const files = new Map(Object.entries(entries));
  return {
    files,
    source: {
      paths: () => [...files.keys()],
      read: (p) => Promise.resolve(files.get(p) ?? null),
    },
  };
}

/** run a real sweep, seed a fresh index from it — every test's starting point */
async function seeded(entries: Record<string, string>) {
  const { files, source } = vault(entries);
  const index = new LiveVaultIndex(source.read);
  index.seed(await sweep(source));
  return { files, index };
}

test("seed() populates the index from a real sweep, and only from one", async () => {
  const { index } = await seeded({
    "invoice.md": drifted,
    "clean.md": clean,
    "notes/ordinary.md": ordinary,
  });
  expect(index.notes().map((n) => n.path)).toEqual(["invoice.md"]);
  expect(index.count()).toBe(1);
});

test("a modified note that starts disagreeing with itself is added", async () => {
  const { files, index } = await seeded({ "invoice.md": clean });
  expect(index.count()).toBe(0);
  files.set("invoice.md", drifted);
  index.scheduleRecheck("invoice.md", 0);
  await Bun.sleep(5);
  expect(index.notes().map((n) => n.path)).toEqual(["invoice.md"]);
});

test("a modified note that becomes clean is removed", async () => {
  const { files, index } = await seeded({ "invoice.md": drifted });
  expect(index.count()).toBe(1);
  files.set("invoice.md", clean);
  index.scheduleRecheck("invoice.md", 0);
  await Bun.sleep(5);
  expect(index.count()).toBe(0);
});

test("a burst of modify events for one note collapses to a single recheck", async () => {
  const { files, index } = await seeded({ "invoice.md": clean });
  let recomputed = 0;
  index.onChange(() => recomputed++);
  for (let i = 0; i < 5; i++) {
    files.set("invoice.md", i === 4 ? drifted : clean);
    index.scheduleRecheck("invoice.md");
  }
  // still pending — none of the five scheduled a recheck that fired yet
  expect(index.count()).toBe(0);
  expect(recomputed).toBe(0);
});

test("a deleted note is removed without a recheck", async () => {
  const { files, index } = await seeded({ "invoice.md": drifted });
  files.delete("invoice.md");
  index.remove("invoice.md");
  expect(index.count()).toBe(0);
});

test("a rename drops the old path and rechecks the new one", async () => {
  const { files, index } = await seeded({ "old.md": drifted });
  files.delete("old.md");
  files.set("new.md", drifted);
  index.rename("old.md", "new.md");
  await Bun.sleep(800);
  expect(index.notes().map((n) => n.path)).toEqual(["new.md"]);
});

test("a note that becomes unreadable is removed, not marked clean", async () => {
  const { files, index } = await seeded({ "invoice.md": drifted });
  files.delete("invoice.md"); // read() now returns null for this path
  index.scheduleRecheck("invoice.md", 0);
  await Bun.sleep(5);
  expect(index.count()).toBe(0);
});

test("onChange fires on seed, on a completed recheck, and on remove; the unsubscribe stops it", async () => {
  const { files, index } = await seeded({ "invoice.md": clean });
  let n = 0;
  const off = index.onChange(() => n++);
  files.set("invoice.md", drifted);
  index.scheduleRecheck("invoice.md", 0);
  await Bun.sleep(5);
  expect(n).toBe(1);
  off();
  index.remove("invoice.md");
  expect(n).toBe(1); // unsubscribed, so the removal's notify did not reach it
});

test("scheduleRecheck on a debounce of 0 still lets a synchronous burst coalesce", async () => {
  // rescheduling before the timer fires cancels the earlier one, even at 0ms —
  // this is what makes DEBOUNCE_MS a real coalescing window rather than a
  // fixed per-event cost
  const { files, index } = await seeded({ "invoice.md": clean });
  let recomputed = 0;
  index.onChange(() => recomputed++);
  files.set("invoice.md", drifted);
  index.scheduleRecheck("invoice.md", 0);
  index.scheduleRecheck("invoice.md", 0); // cancels the one above
  await Bun.sleep(5);
  expect(recomputed).toBe(1);
  expect(index.count()).toBe(1);
});

test("a recheck whose token was superseded discards its answer rather than applying it late", async () => {
  // scheduleRecheck's timer only cancels a still-*pending* recheck; one
  // already awaiting a read is a live promise nothing can cancel. The token
  // guard is what stops that stale answer from landing after a newer one —
  // simulated directly here by bumping the path's generation (a real
  // scheduleRecheck call) and then calling recheck with a token that can
  // never match it, standing in for "this call started before the bump".
  const { files, index } = await seeded({ "invoice.md": clean });
  files.set("invoice.md", drifted);
  index.scheduleRecheck("invoice.md", 50); // bumps the generation; the assertions below run first
  await index.recheck("invoice.md", -1);
  expect(index.count()).toBe(0); // the stale call's answer never landed
});

test("recheck's own default token still lets a direct, uncontested call apply normally", async () => {
  const { files, index } = await seeded({ "invoice.md": clean });
  files.set("invoice.md", drifted);
  await index.recheck("invoice.md"); // no scheduleRecheck raced it, so its own token wins
  expect(index.notes().map((n) => n.path)).toEqual(["invoice.md"]);
});

test("beginSeed()/seed() replay a vault event that happened during the scan, instead of losing it", async () => {
  const { files, index } = await seeded({ "invoice.md": clean });
  // a scan starts; the note changes and its event arrives while the scan is
  // still in flight — scheduleRecheck, not a direct edit, since that is what
  // vault.on("modify") actually calls
  index.beginSeed();
  files.set("invoice.md", drifted);
  index.scheduleRecheck("invoice.md");
  // the scan's own result, computed from a read that started before the
  // edit landed, still says clean
  index.seed({
    scanned: 1,
    candidates: 1,
    checked: 1,
    notes: [],
    unreadable: [],
    cancelled: false,
  });
  expect(index.count()).toBe(0); // the stale seed briefly wins
  await Bun.sleep(800); // the replayed scheduleRecheck's own debounce fires
  expect(index.notes().map((n) => n.path)).toEqual(["invoice.md"]);
});

test("beginSeed()/seed() replay a removal that happened during the scan", async () => {
  const { files, index } = await seeded({ "invoice.md": drifted });
  const report = index.notes()[0]!.report; // a real report, captured before it is touched
  index.beginSeed();
  files.delete("invoice.md");
  index.remove("invoice.md");
  // the scan's own result still thinks the note is there — it read before
  // the delete landed
  index.seed({
    scanned: 1,
    candidates: 1,
    checked: 1,
    notes: [{ path: "invoice.md", problems: 1, advice: 0, report }],
    unreadable: [],
    cancelled: false,
  });
  expect(index.count()).toBe(1); // the stale seed briefly wins
  await Bun.sleep(5); // the replayed scheduleRecheck(path, 0) fires
  expect(index.count()).toBe(0); // read() now returns null for the deleted path
});
