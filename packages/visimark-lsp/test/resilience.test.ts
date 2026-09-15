import { afterAll, beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startServer, type Harness } from "./harness.js";

const here = dirname(fileURLToPath(import.meta.url));
const clean = readFileSync(join(here, "..", "..", "..", "docs", "example-invoice.md"), "utf8");

/**
 * A crash in the engine used to end the server process, not one diagnostic:
 * `runCheck` is invoked as `void runCheck(doc)`, so a throw became an
 * unhandled rejection with nobody above it. The visible symptom was that every
 * VisiMark feature in the editor went dead for every open file until the
 * client restarted the server.
 *
 * Two things are pinned here. The parser's depth cap means the pathological
 * document produces a finding rather than throwing at all, and the catch-all
 * in `runCheck` means that even if something else throws one day, the process
 * survives it. The second test is the one that would have failed before.
 */

const DEEP = `# deep\n\n\`\`\`vmark #s\nx = ${"(".repeat(30_000)}1${")".repeat(30_000)}\n\`\`\`\n`;

let h: Harness;
beforeAll(async () => {
  h = await startServer();
});
afterAll(async () => {
  await h.stop();
});

test("a pathological formula produces a diagnostic, not silence", async () => {
  await h.open("file:///deep.md", DEEP);
  const diags = await h.nextDiagnostics("file:///deep.md");
  expect(diags.length).toBeGreaterThan(0);
  expect(diags.some((d) => /nests more than \d+ levels deep/.test(d.message))).toBe(true);
});

test("the server is still serving the next document afterwards", async () => {
  // Before the fix this failed with `Connection is closed.` — the process was
  // gone, taking hover, code lens and format-on-save with it.
  await h.open("file:///after.md", clean);
  expect(await h.nextDiagnostics("file:///after.md")).toEqual([]);
});
