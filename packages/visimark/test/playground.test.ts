import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createContext, runInContext } from "node:vm";

// The `playground-bundle` CI job only byte-compares the committed bundle
// against a fresh rebuild — it never runs the result, so a bundle that is
// byte-identical to source but throws while loading (as happened when
// `fs/open.ts` read `constants.O_NOFOLLOW` at module scope, which is
// `undefined` under the bundler's browser `node:fs` stub) went undetected.
// This test actually executes the committed bundle in a stand-in for the
// `file://` environment `playground.html` loads it into.
const bundlePath = join(import.meta.dir, "../../../docs/vendor/visimark-browser.js");

function loadBundle(): Record<string, unknown> {
  const source = readFileSync(bundlePath, "utf8");
  const sandbox: Record<string, unknown> = {
    document: {
      createElement: () => ({}),
      currentScript: null,
      addEventListener() {},
      querySelector: () => null,
    },
    navigator: { userAgent: "test" },
    crypto: globalThis.crypto,
  };
  sandbox.window = sandbox;
  createContext(sandbox);
  runInContext(source, sandbox, { filename: "visimark-browser.js" });
  return sandbox.VisiMark as Record<string, unknown>;
}

test("the committed playground bundle assigns window.VisiMark without throwing", () => {
  const VM = loadBundle();
  expect(typeof VM).toBe("object");
  for (const name of [
    "locate",
    "build",
    "check",
    "fmt",
    "infer",
    "planInfer",
    "applyEdits",
    "topoOrder",
    "formatCheck",
    "formatInfer",
    "pgEval",
    "pgExplain",
  ]) {
    expect(typeof VM[name]).toBe("function");
  }
});

test("the bundle's VM.check and VM.pgExplain run over a real document", () => {
  const VM = loadBundle() as {
    locate: (s: string) => unknown;
    build: (m: unknown) => unknown;
    check: (m: unknown) => { findings: unknown[] };
    pgExplain: (s: string) => string[];
  };
  const source = "```vmark #s1\nx = 1\n```\n";
  const model = VM.build(VM.locate(source));
  expect(VM.check(model).findings).toHaveLength(1);
  expect(VM.pgExplain(source)).toContain("#s1  (no table)");
});
