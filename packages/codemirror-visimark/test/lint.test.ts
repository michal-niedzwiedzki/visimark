import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { forEachDiagnostic, forceLinting, type Diagnostic } from "@codemirror/lint";
import { build, check, describeFinding, locate } from "visimark";
import { refresh, visimark } from "../src/index.js";
import { visimarkLint } from "../src/lint.js";
import { SEVERITY } from "../src/severity.js";

const docs = resolve(import.meta.dir, "../../../docs");
const drift = readFileSync(join(docs, "example-invoice-drift.md"), "utf8");
const imports = readFileSync(join(docs, "playground/tutorial/13-imports.md"), "utf8");
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function view(doc: string, withMarks = true): EditorView {
  const extensions = withMarks
    ? [visimark({ recompute: "on-refresh" }), visimarkLint()]
    : [visimarkLint()];
  return new EditorView({ state: EditorState.create({ doc, extensions }), parent: document.body });
}
async function diagnostics(v: EditorView): Promise<Diagnostic[]> {
  await wait(20);
  forceLinting(v);
  await wait(20);
  const out: Diagnostic[] = [];
  forEachDiagnostic(v.state, (d) => out.push(d));
  return out;
}

test("E10: one warning per spanned STALE, in the CLI's words", async () => {
  const v = view(drift);
  const stale = check(build(locate(drift))).findings.filter((f) => f.code === "STALE" && f.span);
  const found = await diagnostics(v);
  const warnings = found.filter((d) => d.severity === "warning");
  expect(warnings).toHaveLength(stale.length);
  for (const d of found) expect(d.source).toBe("visimark");
  expect(warnings.map((d) => d.message).sort()).toEqual(
    stale.map((f) => describeFinding(f)).sort(),
  );
  v.destroy();
});

test("E11: a document with an imported sheet and no reader gets no diagnostics", async () => {
  const v = view(imports);
  expect(await diagnostics(v)).toEqual([]);
  v.destroy();
});

test("E12: lint without visimark() yields nothing and does not throw", async () => {
  const v = view(drift, false);
  expect(await diagnostics(v)).toEqual([]);
  v.destroy();
});

test("Review 5: deleting the last vmark block clears every diagnostic", async () => {
  const v = view(drift);
  expect((await diagnostics(v)).length).toBeGreaterThan(0);
  v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: "# gone\n" } });
  v.dispatch({ effects: refresh.of(null) });
  expect(await diagnostics(v)).toEqual([]);
  v.destroy();
});

test("the severity table: problems are errors, STALE and ANCHOR warn, WARN hints", () => {
  expect(SEVERITY.STALE).toBe("warning");
  expect(SEVERITY.ANCHOR).toBe("warning");
  expect(SEVERITY.WARN).toBe("hint");
  expect(SEVERITY.NOTE).toBe("info");
  for (const code of [
    "DATE",
    "UNIT",
    "UNDEF",
    "DUP",
    "VECTOR",
    "CYCLE",
    "TYPE",
    "SHEET",
    "ASSERT",
    "DOMAIN",
    "ARTIFACT",
    "IMPORT",
    "PRECISION",
    "COVERAGE",
  ] as const) {
    expect(SEVERITY[code]).toBe("error");
  }
});
