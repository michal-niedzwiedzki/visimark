import { beforeEach, expect, test } from "bun:test";
import { COMMANDS, registerCommands } from "../src/commands.js";
import { MESSAGES } from "../src/messages.js";
import { installFakeJoplin, type FakeJoplin } from "./fake-joplin.js";

let fake: FakeJoplin;
beforeEach(async () => {
  fake = installFakeJoplin();
  await registerCommands();
});

test("J8: the group 1 commands, with the spec's ids and labels, in order", () => {
  expect(fake.commands.map((c) => [c.name, c.label])).toEqual([
    ["visimark.check", "VisiMark: Check this note"],
    ["visimark.format", "VisiMark: Format this note"],
    ["visimark.evaluate", "VisiMark: Evaluate this note"],
    ["visimark.explain", "VisiMark: Explain this value"],
  ]);
  expect(COMMANDS.map((c) => c.name)).toEqual(fake.commands.map((c) => c.name));
});

test("J8: Tools → VisiMark lists the same commands in table order", () => {
  expect(fake.menus).toEqual([
    {
      id: "visimark.tools",
      label: "VisiMark",
      items: ["visimark.check", "visimark.format", "visimark.evaluate", "visimark.explain"],
      location: "tools",
    },
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
  expect(fake.editorCalls.length).toBe(4);
  expect(fake.messages).toEqual(fake.commands.map(() => MESSAGES.R1));
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
