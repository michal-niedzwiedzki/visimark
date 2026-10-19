import { expect, test } from "bun:test";
import { statSync } from "node:fs";
import { resolve } from "node:path";

// The engine bundle's ceiling, and the walk that keeps Node out of it, are in
// packages/visimark/test/browser/browser-graph.test.ts.

const playgroundBundle = resolve(import.meta.dir, "../../../docs/vendor/visimark-playground.js");

/**
 * The size of docs/vendor/visimark-playground.js the day CodeMirror 6 was
 * bundled into it (2026-10-11, #360), measured as `wc -c`. Before #360 it was
 * 39,450 bytes and CodeMirror 5 came from cdnjs. Same discipline as the
 * engine bundle's BASELINE_BYTES: bump it only with a dated, reviewed reason.
 */
const PLAYGROUND_BASELINE_BYTES = 580_813;
const PLAYGROUND_MAX_BYTES = Math.ceil(PLAYGROUND_BASELINE_BYTES * 1.1);

test("the playground application bundle stays under its ceiling", () => {
  const actual = statSync(playgroundBundle).size;
  expect(
    actual,
    `docs/vendor/visimark-playground.js is ${actual} bytes, over the ${PLAYGROUND_MAX_BYTES}-byte ` +
      `ceiling. If the growth is real and reviewed, bump PLAYGROUND_BASELINE_BYTES with the date ` +
      `and reason; if not, look for a second CodeMirror language or an engine import in the app.`,
  ).toBeLessThanOrEqual(PLAYGROUND_MAX_BYTES);
});
