import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import codemirror from "../src/codemirrorContentScript.js";
import { editorCommands } from "../src/editor-commands.js";
import type { CheckReply, EvaluateReply, ExplainReply, FormatReply } from "../src/protocol.js";

const root = resolve(import.meta.dir, "../../..");
const docs = join(root, "docs");
const drift = readFileSync(join(docs, "example-invoice-drift.md"), "utf8");
const mainTs = join(root, "packages/visimark/src/cli/main.ts");

/** What the CLI does to (or says about) a copy of `source`, in a fresh directory. */
async function cli(args: string[], source: string, name = "note.md") {
  const dir = mkdtempSync(join(tmpdir(), "joplin-cli-"));
  const file = join(dir, name);
  writeFileSync(file, source);
  const proc = Bun.spawn(["bun", mainTs, ...args, file], { cwd: dir, stdout: "pipe" });
  const stdout = await new Response(proc.stdout).text();
  await proc.exited;
  return { stdout, after: readFileSync(file, "utf8"), file };
}

const views: EditorView[] = [];
afterEach(() => {
  for (const v of views.splice(0)) v.destroy();
});

function editor(doc: string): { view: EditorView; run: ReturnType<typeof editorCommands> } {
  const view = new EditorView({ state: EditorState.create({ doc }), parent: document.body });
  views.push(view);
  return { view, run: editorCommands(view) };
}

/** Counts the transactions a command dispatches. */
function counting(view: EditorView): () => number {
  let n = 0;
  const dispatch = view.dispatch.bind(view);
  view.dispatch = ((...args: Parameters<EditorView["dispatch"]>) => {
    n++;
    return dispatch(...args);
  }) as EditorView["dispatch"];
  return () => n;
}

test("J1: format without fixDates writes the bytes `visimark fmt` writes", async () => {
  const { view, run } = editor(drift);
  const transactions = counting(view);
  const reply = run.format({ fixDates: false }) as FormatReply;
  expect(reply.kind).toBe("applied");
  expect(transactions()).toBe(1);
  expect(view.state.doc.toString()).toBe((await cli(["fmt"], drift)).after);
});

test("J2: format with fixDates writes the bytes `visimark fmt --fix-dates` writes", async () => {
  const { view, run } = editor(drift);
  expect((run.format({ fixDates: true }) as FormatReply).kind).toBe("applied");
  expect(view.state.doc.toString()).toBe((await cli(["fmt", "--fix-dates"], drift)).after);
});

test("J1: a formatted note formats clean, and reports how many repairs it made", async () => {
  const { run } = editor(drift);
  const first = run.format({ fixDates: false }) as FormatReply;
  expect(first).toEqual({ kind: "applied", repairs: 15, importsDropped: false });
  expect(run.format({ fixDates: false })).toEqual({ kind: "clean", importsDropped: false });
});

test("J3: check's text is `visimark check`'s stdout with the title for the path", async () => {
  const { run } = editor(drift);
  const reply = run.check({ title: "example-invoice-drift.md" }) as CheckReply;
  const { stdout, file } = await cli(["check"], drift, "example-invoice-drift.md");
  expect(reply.kind).toBe("checked");
  if (reply.kind !== "checked") return;
  // the CLI prints the text with a line end; the dialog shows the text
  expect(reply.text + "\n").toBe(stdout.replace(file, "example-invoice-drift.md"));
  expect(reply.problems).toBe(27);
  expect(reply.importsDropped).toBe(false);
});

// A sheet that imports, a doc-scope value that reads it, and a stale value in
// a second sheet that does not.
const mixed = [
  "# Mixed",
  "",
  "Grand total **999**<!--vmark=order.grand_total-->.",
  "",
  "```vmark #order from order.csv labelled Item, Qty, Price, Total",
  "grand_total = SUM(Total)",
  "```",
  "",
  "```vmark",
  "plus = order.grand_total + 1",
  "first = order.Total + 1",
  "```",
  "",
  "| Item | Qty | Net |",
  "|------|----:|----:|",
  "| pen  |  2  | 11.00 |",
  "",
  "```vmark #lines",
  "Net precision 2 = Qty * 5",
  "```",
  "",
].join("\n");

test("J4: imports are dropped, and everything else is checked and repaired", () => {
  const { view, run } = editor(mixed);
  const checked = run.check({ title: "mixed" }) as CheckReply;
  expect(checked.kind).toBe("checked");
  if (checked.kind !== "checked") return;
  expect(checked.importsDropped).toBe(true);
  expect(checked.text).toContain("lines.Net");
  expect(checked.text).not.toContain("UNDEF");
  expect(checked.problems).toBe(1);

  const values = run.evaluate() as EvaluateReply;
  expect(values.kind).toBe("values");
  if (values.kind !== "values") return;
  expect(values.importsDropped).toBe(true);
  expect(values.rows.map((r) => r.name)).toEqual(["lines.Net"]);

  expect(run.format({ fixDates: false })).toEqual({
    kind: "applied",
    repairs: 1,
    importsDropped: true,
  });
  expect(view.state.doc.toString()).toBe(mixed.replace("11.00", "10.00"));
});

test("J4: explain on an import-dependent value declines, and says why", () => {
  const { view, run } = editor(mixed);
  view.dispatch({ selection: { anchor: mixed.indexOf("plus =") + 1 } });
  expect(run.explain()).toEqual({ kind: "not-on-value", importsDropped: true });
});

test("explain answers for the stale cell the cursor is on, and declines on prose", () => {
  const { view, run } = editor(drift);
  const cell = drift.indexOf("3120.00", drift.indexOf("| On-call support"));
  view.dispatch({ selection: { anchor: cell + 1 } });
  const reply = run.explain() as ExplainReply;
  expect(reply.kind).toBe("explained");
  if (reply.kind !== "explained") return;
  expect(reply.explanation.name).toBe("lines.Net");
  expect(reply.explanation.source).toContain("Net");
  expect(reply.row).toBeGreaterThanOrEqual(0);

  view.dispatch({ selection: { anchor: 2 } });
  expect(run.explain()).toEqual({ kind: "not-on-value" });
});

test("evaluate lists every value, in the CLI's own values", async () => {
  const { run } = editor(drift);
  const reply = run.evaluate() as EvaluateReply;
  expect(reply.kind).toBe("values");
  if (reply.kind !== "values") return;
  const json = JSON.parse((await cli(["eval", "--json"], drift)).stdout).values;
  expect(reply.rows.map((r) => r.name).sort()).toEqual(Object.keys(json).sort());
});

test("J7: a note with no vmark block answers no-block to every command, and is untouched", () => {
  const plain = "# Groceries\n\n- milk\n- 2 eggs\n";
  const { view, run } = editor(plain);
  const transactions = counting(view);
  expect(run.check({ title: "g" })).toEqual({ kind: "no-block" });
  expect(run.format({ fixDates: true })).toEqual({ kind: "no-block" });
  expect(run.evaluate()).toEqual({ kind: "no-block" });
  expect(run.explain()).toEqual({ kind: "no-block" });
  expect(transactions()).toBe(0);
  expect(view.state.doc.toString()).toBe(plain);
});

test("an engine throw answers failed and changes nothing", () => {
  const { view } = editor(drift);
  const transactions = counting(view);
  const broken = editorCommands(view, {
    analyse: () => {
      throw new Error("boom");
    },
  });
  expect(broken.format({ fixDates: false })).toEqual({ kind: "failed" });
  expect(broken.check({ title: "x" })).toEqual({ kind: "failed" });
  expect(transactions()).toBe(0);
  expect(view.state.doc.toString()).toBe(drift);
});

test("the content script registers the four editor commands on a CodeMirror 6 editor", () => {
  const names: string[] = [];
  const { view } = editor("");
  codemirror({}).plugin({
    cm6: view,
    addExtension: () => {},
    registerCommand: (name: string) => void names.push(name),
  });
  expect(names).toEqual([
    "visimark.cm.check",
    "visimark.cm.format",
    "visimark.cm.evaluate",
    "visimark.cm.explain",
  ]);
});
