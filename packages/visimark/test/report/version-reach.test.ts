import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import * as browser from "../../src/browser.js";
import * as index from "../../src/index.js";
import { errorEnvelope, explainJson } from "../../src/report/envelope.js";
import { explainBody } from "../../src/report/explain.js";
import { build, check, locate } from "../../src/index.js";
import { explainView } from "../../src/report/explain.js";
import { cleanPath } from "../examples.js";

/**
 * **The invariant issue #204 established, asserted rather than remembered.**
 *
 * `readVersion()` imports `node:module`. A module-scope import taints its
 * whole module, and a bundler resolves before it shakes — so *one* call to it
 * anywhere under `src/report/` puts every shape in that file beyond the reach
 * of a browser build. That is how one string came to keep `explainView`, which
 * needs no version at all, out of the Obsidian plugin's hover popover, its
 * Explain command and its public API, and the `--json` envelope out of the
 * browser half of the cross-host check.
 *
 * `report/envelope.ts` is the one module allowed to reach it. A second one is
 * not a style question; it is the same outage again, and the file that would
 * notice — `src/browser.ts`'s graph guard — names a symptom rather than the
 * cause. This test names the cause.
 */

const reportDir = resolve(import.meta.dir, "../../src/report");

/** the one module in `src/report/` that may read the engine's own version */
const STAMPED = "envelope.ts";

test(`only report/${STAMPED} reaches the engine version`, () => {
  const offenders = readdirSync(reportDir)
    .filter((f) => f.endsWith(".ts") && f !== STAMPED)
    .filter((f) =>
      /from\s+"\.\.\/cli\/version\.js"/.test(readFileSync(join(reportDir, f), "utf8")),
    );
  expect(
    offenders,
    `src/report/${offenders.join(", ")} imports cli/version.js. readVersion() imports ` +
      `node:module, which takes the whole module out of every browser build — including the ` +
      `shapes in it that never wanted a version. Put the stamped builder in ${STAMPED} and ` +
      `have it call the pure one here. Issue #204.`,
  ).toEqual([]);
});

test("the public names and signatures are exactly what they were", () => {
  // the whole claim of #204's chosen option: a move, not an API change
  expect(typeof index.errorEnvelope).toBe("function");
  expect(typeof index.explainJson).toBe("function");
  expect(index.errorEnvelope.length).toBe(3);
  expect(index.explainJson.length).toBe(2);
  expect(index.errorEnvelope).toBe(errorEnvelope);
  expect(index.explainJson).toBe(explainJson);
});

test("the stamped builders are not in the browser surface, and that is deliberate", () => {
  // a browser host does not know which engine built it. It gets every piece of
  // the envelope and supplies its own stamp if it has one.
  expect("errorEnvelope" in browser).toBe(false);
  expect("explainJson" in browser).toBe(false);
  expect("explainView" in browser).toBe(true);
  expect("publicFinding" in browser).toBe(true);
  expect("findingSummary" in browser).toBe(true);
});

test("explainBody is internal: neither entry point exports it", () => {
  // it exists so envelope.ts can stamp it, not as a second public way to build
  // an explain document
  expect(typeof explainBody).toBe("function");
  expect("explainBody" in index).toBe(false);
  expect("explainBody" in browser).toBe(false);
});

test("the stamped envelope is the body plus exactly three keys, in order", () => {
  const source = readFileSync(cleanPath, "utf8");
  const model = build(locate(source));
  const view = explainView(model, check(model), []);
  const body = explainBody(view, cleanPath) as Record<string, unknown>;
  const stamped = explainJson(view, cleanPath) as Record<string, unknown>;

  expect(Object.keys(stamped)).toEqual(["command", "visimark", ...Object.keys(body)]);
  expect(stamped.command).toBe("explain");
  expect(typeof stamped.visimark).toBe("string");
  for (const [k, v] of Object.entries(body)) expect(stamped[k]).toEqual(v);
});
