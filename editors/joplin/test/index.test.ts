import { beforeEach, expect, test } from "bun:test";
import { COMMANDS, registerCommands } from "../src/commands.js";
import { MESSAGES } from "../src/messages.js";
import { installFakeJoplin, type FakeJoplin } from "./fake-joplin.js";

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
];

test("J8: the group 1 and 2 commands, with the spec's ids and labels, in order", () => {
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
  ]);
  expect(COMMANDS.map((c) => c.name)).toEqual(IDS);
});

test("J8: Tools → VisiMark lists the same commands in table order", () => {
  expect(fake.menus).toEqual([
    { id: "visimark.tools", label: "VisiMark", items: IDS, location: "tools" },
  ]);
});

test("J8: Explain is also in the editor context menu", () => {
  expect(fake.menuItems).toEqual([
    {
      id: "visimark.explain.context",
      commandName: "visimark.explain",
      location: "editorContextMenu",
    },
  ]);
});

test("R1: in the Rich Text editor every command says so and calls nothing", async () => {
  fake.settings["editor.codeView"] = false;
  for (const c of fake.commands) await c.execute();
  expect(fake.editorCalls).toEqual([]);
  expect(fake.messages).toEqual(fake.commands.map(() => MESSAGES.R1));
});

test("R1: with no CodeMirror 6 content script loaded, every command says so", async () => {
  for (const c of fake.commands) await c.execute();
  expect(fake.editorCalls.length).toBe(IDS.length);
  expect(fake.messages).toEqual(fake.commands.map(() => MESSAGES.R1));
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

test("Check shows the CLI text in a monospace block, titled by the note", async () => {
  fake.editor["visimark.cm.check"] = {
    kind: "checked",
    text: "a <b> & c",
    problems: 1,
    importsDropped: true,
  };
  await fake.run("visimark.check");
  expect(fake.editorCalls).toEqual([
    { name: "visimark.cm.check", args: [{ title: "example-invoice-drift.md" }] },
  ]);
  expect(fake.dialogs).toHaveLength(1);
  expect(fake.dialogs[0]).toContain("<pre>a &lt;b&gt; &amp; c</pre>");
  expect(fake.dialogs[0]).toContain(MESSAGES.I1);
  // a second Check reuses the dialog rather than creating it again
  await fake.run("visimark.check");
  expect(fake.dialogs).toHaveLength(2);
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
  fake.answer = "apply";
  await fake.run("visimark.infer");
  expect(fake.buttons).toEqual([["apply", "cancel"]]);
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
  fake.answer = "apply";
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
