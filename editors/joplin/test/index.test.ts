import { beforeEach, expect, test } from "bun:test";
import { COMMANDS, registerCommands } from "../src/commands.js";
import { MESSAGES } from "../src/messages.js";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { installFakeJoplin, type FakeJoplin } from "./fake-joplin.js";

const drift = readFileSync(
  join(resolve(import.meta.dir, "../../../docs"), "example-invoice-drift.md"),
  "utf8",
);

let fake: FakeJoplin;
beforeEach(async () => {
  fake = installFakeJoplin();
  await registerCommands();
});

const IDS = [
  "visimark.check",
  "visimark.format",
  "visimark.evaluate",
  "visimark.explain",
  "visimark.infer",
  "visimark.insertInvoiceTemplate",
  "visimark.insertBudgetTemplate",
  "visimark.insertCapacityTemplate",
  "visimark.insertExperimentTemplate",
  "visimark.toggleFindings",
  "visimark.sweep",
];

test("J8: every command, with the spec's ids and labels, in order", () => {
  expect(fake.commands.map((c) => [c.name, c.label])).toEqual([
    ["visimark.check", "VisiMark: Check this note"],
    ["visimark.format", "VisiMark: Format this note"],
    ["visimark.evaluate", "VisiMark: Evaluate this note"],
    ["visimark.explain", "VisiMark: Explain this value"],
    ["visimark.infer", "VisiMark: Infer the formulas"],
    ["visimark.insertInvoiceTemplate", "VisiMark: Insert invoice template"],
    ["visimark.insertBudgetTemplate", "VisiMark: Insert monthly budget template"],
    ["visimark.insertCapacityTemplate", "VisiMark: Insert team capacity template"],
    ["visimark.insertExperimentTemplate", "VisiMark: Insert experiment log template"],
    ["visimark.toggleFindings", "VisiMark: Show findings panel"],
    ["visimark.sweep", "VisiMark: Sweep this notebook"],
  ]);
  expect(COMMANDS.map((c) => c.name)).toEqual(IDS);
});

test("J8: Tools → VisiMark lists the same commands in table order", () => {
  expect(fake.menus).toEqual([
    { id: "visimark.tools", label: "VisiMark", items: IDS, location: "tools" },
  ]);
});

test("J8: Explain is in the editor context menu, Sweep in the notebook context menu", () => {
  expect(fake.menuItems).toEqual([
    {
      id: "visimark.explain.context",
      commandName: "visimark.explain",
      location: "editorContextMenu",
    },
    { id: "visimark.sweep.folder", commandName: "visimark.sweep", location: "folderContextMenu" },
  ]);
});

/** the commands that need the Markdown editor: all but Check and the panel's two */
const EDITOR_ONLY = IDS.filter(
  (id) => !["visimark.check", "visimark.toggleFindings", "visimark.sweep"].includes(id),
);

test("R1: in the Rich Text editor every editor command says so and calls nothing", async () => {
  fake.settings["editor.codeView"] = false;
  for (const id of EDITOR_ONLY) await fake.run(id);
  expect(fake.editorCalls).toEqual([]);
  expect(fake.messages).toEqual(EDITOR_ONLY.map(() => MESSAGES.R1));
});

test("R1: with no CodeMirror 6 content script loaded, every editor command says so", async () => {
  for (const id of EDITOR_ONLY) await fake.run(id);
  expect(fake.editorCalls.length).toBe(EDITOR_ONLY.length);
  expect(fake.messages).toEqual(EDITOR_ONLY.map(() => MESSAGES.R1));
});

test("a rejected editor command shows F2 rather than failing silently", async () => {
  joplin.commands.execute = async () => {
    throw new Error("ipc");
  };
  await fake.run("visimark.format");
  expect(fake.messages).toEqual([MESSAGES.F2]);
});

test("Format passes fixDates off and reports the repairs", async () => {
  fake.editor["visimark.cm.format"] = { kind: "applied", repairs: 15, importsDropped: false };
  await fake.run("visimark.format");
  expect(fake.editorCalls).toEqual([{ name: "visimark.cm.format", args: [{ fixDates: false }] }]);
  expect(fake.messages).toEqual(["Applied 15 repairs."]);
});

test("Format's other answers", async () => {
  const cases: [unknown, string][] = [
    [{ kind: "applied", repairs: 1, importsDropped: false }, "Applied 1 repair."],
    [{ kind: "clean", importsDropped: false }, MESSAGES.C1],
    [{ kind: "no-block" }, MESSAGES.N1],
    [{ kind: "failed" }, MESSAGES.F2],
    [{ kind: "clean", importsDropped: true }, `${MESSAGES.C1}\n\n${MESSAGES.I1}`],
  ];
  for (const [reply, message] of cases) {
    fake.messages.length = 0;
    fake.editor["visimark.cm.format"] = reply;
    await fake.run("visimark.format");
    expect(fake.messages).toEqual([message]);
  }
});

test("Check opens the findings panel on the selected note, in either editor", async () => {
  fake.settings["editor.codeView"] = false;
  fake.note = { id: "n1", title: "drift", body: drift };
  await fake.run("visimark.check");
  expect(fake.panel.visible).toBe(true);
  expect(fake.panel.html).toContain("problems");
  expect(fake.panel.html).toContain("STALE lines.Net · On-call support");
  expect(fake.editorCalls).toEqual([]);
  expect(fake.messages).toEqual([]);
});

test("Show findings panel toggles it, and the panel is created once", async () => {
  fake.note = { id: "n1", title: "plain", body: "# Plain\n" };
  await fake.run("visimark.toggleFindings");
  expect(fake.panel.visible).toBe(true);
  expect(fake.panel.html).toContain(MESSAGES.N1);
  expect(fake.panel.scripts).toEqual(["./panel.css", "./panel.js"]);
  await fake.run("visimark.toggleFindings");
  expect(fake.panel.visible).toBe(false);
  expect(fake.panel.created).toBe(1);
});

test("a panel row reveals its span in the Markdown editor, and nothing in Rich Text", async () => {
  await fake.run("visimark.toggleFindings");
  fake.editor["visimark.cm.reveal"] = { kind: "ok" };
  await fake.panelMessage!({ kind: "reveal", start: 10, end: 17 });
  expect(fake.editorCalls).toEqual([
    { name: "visimark.cm.reveal", args: [{ start: 10, end: 17 }] },
  ]);
  fake.settings["editor.codeView"] = false;
  await fake.panelMessage!({ kind: "reveal", start: 10, end: 17 });
  expect(fake.editorCalls).toHaveLength(1);
});

test("Sweep takes the notebook it is given, or the selected one, and opens a listed note", async () => {
  const asked: string[] = [];
  fake.data = async (path) => {
    asked.push(path.join("/"));
    if (path[0] === "folders" && path.length === 1) return { items: [], has_more: false };
    if (path[2] === "notes") return { items: [{ id: "x", title: "Drift" }], has_more: false };
    return { body: drift };
  };
  await fake.run("visimark.sweep", "f9");
  expect(asked).toContain("folders/f9/notes");
  expect(fake.panel.html).toContain("Drift");
  expect(fake.panel.html).toContain('data-action="open"');
  await fake.panelMessage!({ kind: "open", id: "x" });
  expect(fake.executed).toEqual([{ name: "openNote", args: ["x"] }]);

  asked.length = 0;
  await fake.run("visimark.sweep");
  expect(asked).toContain("folders/f1/notes");
});

test("Evaluate shows a table of names and values", async () => {
  fake.editor["visimark.cm.evaluate"] = {
    kind: "values",
    rows: [{ name: "lines.Net", kind: "column", value: "1, 2" }],
    importsDropped: false,
  };
  await fake.run("visimark.evaluate");
  expect(fake.dialogs[0]).toContain("<table");
  expect(fake.dialogs[0]).toContain("<td>lines.Net</td><td>1, 2</td>");
});

test("Explain shows the binding, its value and its inputs; off a value it asks again", async () => {
  fake.editor["visimark.cm.explain"] = {
    kind: "explained",
    explanation: {
      name: "lines.Net",
      kind: "column",
      source: "Net = Qty * Rate",
      value: ["10", "5200.00"],
      inputs: ["lines.Qty", "lines.Rate"],
      precision: 2,
    },
    row: 1,
  };
  await fake.run("visimark.explain");
  expect(fake.messages).toEqual([
    "lines.Net\n\nNet = Qty * Rate\n\nIt comes to 5200.00.\nWorked out from lines.Qty, lines.Rate.\nWritten to 2 decimal places.",
  ]);

  fake.messages.length = 0;
  fake.editor["visimark.cm.explain"] = { kind: "not-on-value" };
  await fake.run("visimark.explain");
  fake.editor["visimark.cm.explain"] = { kind: "not-on-value", importsDropped: true };
  await fake.run("visimark.explain");
  expect(fake.messages).toEqual([MESSAGES.X1, `${MESSAGES.X1}\n\n${MESSAGES.I1}`]);
});

const preview = {
  kind: "preview",
  version: 3,
  description: "VisiMark can work out 1 column. Nothing you have written is changed.",
  empty: false,
  edits: [{ start: 9, end: 9, text: "\n```vmark\nTotal = Price * Qty\n```\n" }],
};

test("Infer shows the preview with Apply and Cancel, and Apply sends its version back", async () => {
  fake.editor["visimark.cm.inferPreview"] = preview;
  fake.editor["visimark.cm.apply"] = { kind: "applied" };
  fake.answer = "confirm";
  await fake.run("visimark.infer");
  expect(fake.buttons).toEqual([["confirm", "cancel"]]);
  expect(fake.dialogs[0]).toContain("VisiMark can work out 1 column.");
  expect(fake.dialogs[0]).toContain("Total = Price * Qty");
  expect(fake.editorCalls.at(-1)).toEqual({
    name: "visimark.cm.apply",
    args: [{ version: 3, edits: preview.edits }],
  });
  expect(fake.messages).toEqual([]);
});

test("Infer says when Apply removes the note's no-formulas comment", async () => {
  fake.editor["visimark.cm.inferPreview"] = { ...preview, removesMarker: true };
  fake.answer = "cancel";
  await fake.run("visimark.infer");
  expect(fake.dialogs[0]).toContain(
    "This table already said it had no formulas to check. That comment will be removed, since it now does.",
  );
});

test("a dialog closed without a button counts as Cancel", async () => {
  fake.editor["visimark.cm.inferPreview"] = preview;
  (joplin.views.dialogs as { open: unknown }).open = async () => null;
  await fake.run("visimark.infer");
  expect(fake.editorCalls.map((c) => c.name)).toEqual(["visimark.cm.inferPreview"]);
});

test("Infer's Cancel writes nothing", async () => {
  fake.editor["visimark.cm.inferPreview"] = preview;
  fake.answer = "cancel";
  await fake.run("visimark.infer");
  expect(fake.editorCalls.map((c) => c.name)).toEqual(["visimark.cm.inferPreview"]);
});

test("Infer with nothing to propose shows OK only", async () => {
  fake.editor["visimark.cm.inferPreview"] = {
    ...preview,
    empty: true,
    description: "There is nothing here to work out.",
    edits: [],
  };
  await fake.run("visimark.infer");
  expect(fake.buttons).toEqual([["ok"]]);
  expect(fake.editorCalls.map((c) => c.name)).toEqual(["visimark.cm.inferPreview"]);
});

test("Infer's Apply on a note that moved says A1", async () => {
  fake.editor["visimark.cm.inferPreview"] = preview;
  fake.editor["visimark.cm.apply"] = { kind: "changed" };
  fake.answer = "confirm";
  await fake.run("visimark.infer");
  expect(fake.messages).toEqual([MESSAGES.A1]);
});

test("each template command inserts its own template, and says T1 or T2 when refused", async () => {
  fake.editor["visimark.cm.insertTemplate"] = { kind: "inserted" };
  await fake.run("visimark.insertBudgetTemplate");
  expect(fake.editorCalls).toEqual([
    { name: "visimark.cm.insertTemplate", args: [{ id: "budget" }] },
  ]);
  expect(fake.messages).toEqual([]);

  fake.editor["visimark.cm.insertTemplate"] = { kind: "has-block" };
  await fake.run("visimark.insertInvoiceTemplate");
  fake.editor["visimark.cm.insertTemplate"] = { kind: "no-place" };
  await fake.run("visimark.insertExperimentTemplate");
  expect(fake.messages).toEqual([MESSAGES.T1, MESSAGES.T2]);
});
