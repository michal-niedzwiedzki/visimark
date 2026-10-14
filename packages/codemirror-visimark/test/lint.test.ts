import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { EditorState, type Transaction } from "@codemirror/state";
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

// #384 spec §2.2: quick fixes, the same set visimark-lsp's codeActionsFor offers.

const at = (v: EditorView, needle: string, from = 0): number => {
  const i = v.state.doc.toString().indexOf(needle, from);
  if (i < 0) throw new Error(`no ${needle}`);
  return i;
};
const onSpan = (found: Diagnostic[], from: number): Diagnostic => {
  const d = found.find((x) => x.from === from);
  if (!d) throw new Error(`no diagnostic at ${from}`);
  return d;
};
const names = (d: Diagnostic): string[] => (d.actions ?? []).map((a) => a.name);
function run(v: EditorView, d: Diagnostic, index = 0): void {
  d.actions![index]!.apply(v, d.from, d.to);
}

test("L1: a stale cell offers its update, and applying it changes that cell only", async () => {
  const v = view(drift);
  const row = at(v, "| On-call support");
  const from = at(v, "3120.00", row);
  const d = onSpan(await diagnostics(v), from);
  expect(names(d)).toEqual(["Update to 5200.00"]);
  run(v, d);
  expect(v.state.doc.toString()).toBe(
    drift.slice(0, from) + "5200.00" + drift.slice(from + "3120.00".length),
  );
  v.destroy();
});

test("L2: a decidable date offers its ISO rewrite", async () => {
  const v = view(drift);
  const from = at(v, "15.10.2026");
  const d = onSpan(await diagnostics(v), from);
  expect(names(d)).toEqual(["Rewrite to 2026-10-15"]);
  run(v, d);
  expect(v.state.doc.toString()).toBe(
    drift.slice(0, from) + "2026-10-15" + drift.slice(from + "15.10.2026".length),
  );
  v.destroy();
});

test("L3: an ambiguous date offers nothing", async () => {
  const v = view(drift);
  expect(names(onSpan(await diagnostics(v), at(v, "11/12/2026")))).toEqual([]);
  v.destroy();
});

test("L4: an unknown name offers the did-you-mean", async () => {
  const v = view(drift);
  const from = at(v, "fx_rate");
  const d = onSpan(await diagnostics(v), from);
  expect(names(d)).toEqual(["Change to fx_eur"]);
  run(v, d);
  expect(v.state.sliceDoc(from, from + "fx_eur".length)).toBe("fx_eur");
  v.destroy();
});

test("L5: a column used as a value offers to wrap it in SUM", async () => {
  const v = view(drift);
  const from = at(v, "schedule.Amount", at(v, "variance"));
  const d = onSpan(await diagnostics(v), from);
  expect(names(d)).toEqual(["Wrap in SUM(schedule.Amount)"]);
  run(v, d);
  expect(v.state.sliceDoc(from, from + "SUM(schedule.Amount)".length)).toBe("SUM(schedule.Amount)");
  v.destroy();
});

test("L6: every update is one transaction, and inverting it restores the document", async () => {
  // One transaction is what makes one undo restore the note in any host with
  // history(); inverting its changes is that undo without the extra package.
  const seen: Transaction[] = [];
  const v = new EditorView({
    state: EditorState.create({
      doc: drift,
      extensions: [
        visimark({ recompute: "on-refresh" }),
        visimarkLint(),
        EditorView.updateListener.of((u) => {
          for (const tr of u.transactions) if (tr.docChanged) seen.push(tr);
        }),
      ],
    }),
    parent: document.body,
  });
  const updates = (await diagnostics(v)).filter((d) => names(d)[0]?.startsWith("Update to "));
  expect(updates.length).toBeGreaterThan(0);
  for (const d of updates) {
    const before = v.state.doc;
    seen.length = 0;
    run(v, d);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.changes.invert(before).apply(v.state.doc).toString()).toBe(before.toString());
  }
  v.destroy();
});

test("other findings carry no action", async () => {
  const v = view(drift);
  const fixable = new Set(["Update to", "Rewrite to", "Change to", "Wrap in SUM("]);
  for (const d of await diagnostics(v)) {
    for (const name of names(d)) {
      expect(
        [...fixable].some((p) => name.startsWith(p)),
        name,
      ).toBe(true);
    }
  }
  v.destroy();
});
