import type { Explanation } from "visimark-editor-shared/explain.js";
import { MESSAGES, applied, withImports } from "./messages.js";
import {
  EDITOR_COMMANDS,
  type CheckReply,
  type EvaluateReply,
  type ExplainReply,
  type FormatReply,
} from "./protocol.js";

/**
 * The palette commands and the Tools → VisiMark submenu (#384 spec §2.3,
 * group 1). This runs in the main script, which holds no engine: each command
 * routes to an editor command in the CodeMirror content script through
 * `editor.execCommand`, and shows what comes back.
 */

interface PaletteCommand {
  readonly name: string;
  readonly label: string;
  readonly execute: () => Promise<void>;
}

export const COMMANDS: readonly PaletteCommand[] = [
  { name: "visimark.check", label: "VisiMark: Check this note", execute: checkNote },
  { name: "visimark.format", label: "VisiMark: Format this note", execute: formatNote },
  { name: "visimark.evaluate", label: "VisiMark: Evaluate this note", execute: evaluateNote },
  { name: "visimark.explain", label: "VisiMark: Explain this value", execute: explainValue },
];

export async function registerCommands(): Promise<void> {
  for (const { name, label, execute } of COMMANDS) {
    await joplin.commands.register({ name, label, execute });
  }
  await joplin.views.menus.create(
    "visimark.tools",
    "VisiMark",
    COMMANDS.map((c) => ({ commandName: c.name })),
    "tools",
  );
  await joplin.views.menuItems.create(
    "visimark.explain.context",
    "visimark.explain",
    "editorContextMenu",
  );
}

/**
 * Runs one editor command, or shows R1 and answers `null` when there is no
 * Markdown editor to run it in: the Rich Text editor is open, or no
 * CodeMirror 6 content script answered (`undefined`).
 */
async function inEditor<T>(name: string, args?: object): Promise<T | null> {
  if ((await joplin.settings.globalValue("editor.codeView")) === false) {
    await say(MESSAGES.R1);
    return null;
  }
  let reply;
  try {
    reply = await joplin.commands.execute("editor.execCommand", {
      name,
      args: args === undefined ? [] : [args],
    });
  } catch {
    await say(MESSAGES.F2);
    return null;
  }
  if (reply === undefined || reply === null) {
    await say(MESSAGES.R1);
    return null;
  }
  return reply as T;
}

async function checkNote(): Promise<void> {
  const title = (await joplin.workspace.selectedNote())?.title ?? "";
  const reply = await inEditor<CheckReply>(EDITOR_COMMANDS.check, { title });
  if (reply === null) return;
  if (reply.kind === "no-block") return say(MESSAGES.N1);
  if (reply.kind === "failed") return say(MESSAGES.F2);
  const imports = reply.importsDropped ? `<p>${escape(MESSAGES.I1)}</p>` : "";
  await showDialog("visimark.check", `<pre>${escape(reply.text)}</pre>${imports}`);
}

async function formatNote(): Promise<void> {
  // dates stay as written until group 3's `fixDatesOnFormat` setting, the
  // same default as `visimark fmt` without `--fix-dates`
  const reply = await inEditor<FormatReply>(EDITOR_COMMANDS.format, { fixDates: false });
  if (reply === null) return;
  switch (reply.kind) {
    case "no-block":
      return say(MESSAGES.N1);
    case "failed":
      return say(MESSAGES.F2);
    case "clean":
      return say(withImports(MESSAGES.C1, reply.importsDropped));
    case "applied":
      return say(withImports(applied(reply.repairs), reply.importsDropped));
  }
}

async function evaluateNote(): Promise<void> {
  const reply = await inEditor<EvaluateReply>(EDITOR_COMMANDS.evaluate);
  if (reply === null) return;
  if (reply.kind === "no-block") return say(MESSAGES.N1);
  if (reply.kind === "failed") return say(MESSAGES.F2);
  const rows = reply.rows
    .map((r) => `<tr><td>${escape(r.name)}</td><td>${escape(r.value)}</td></tr>`)
    .join("");
  const imports = reply.importsDropped ? `<p>${escape(MESSAGES.I1)}</p>` : "";
  await showDialog("visimark.evaluate", `<table class="visimark-values">${rows}</table>${imports}`);
}

async function explainValue(): Promise<void> {
  const reply = await inEditor<ExplainReply>(EDITOR_COMMANDS.explain);
  if (reply === null) return;
  switch (reply.kind) {
    case "no-block":
      return say(MESSAGES.N1);
    case "failed":
      return say(MESSAGES.F2);
    case "not-on-value":
      return say(withImports(MESSAGES.X1, reply.importsDropped));
    case "explained":
      return say(explanationText(reply.explanation, reply.row));
  }
}

/**
 * The binding line verbatim, what it comes to and what it reads — the
 * Obsidian plugin's Explain dialog, as text. `row` picks one cell of a
 * column; without it a column shows every row.
 */
export function explanationText(e: Explanation, row?: number): string {
  const value = !Array.isArray(e.value)
    ? e.value
    : row !== undefined
      ? (e.value[row] ?? "?")
      : e.value.map((v) => v ?? "?").join(", ");
  const lines = [
    value === null
      ? "It has no value at the moment — something it reads could not be worked out."
      : `It comes to ${value}.`,
    e.inputs.length > 0
      ? `Worked out from ${e.inputs.join(", ")}.`
      : "It reads nothing else — it is written down rather than worked out.",
  ];
  if (e.precision !== null) {
    lines.push(
      `Written to ${e.precision} ${e.precision === 1 ? "decimal place" : "decimal places"}.`,
    );
  }
  return `${e.name}\n\n${e.source.trim()}\n\n${lines.join("\n")}`;
}

async function say(message: string): Promise<void> {
  await joplin.views.dialogs.showMessageBox(message);
}

/** A dialog per id, created on first use: Joplin refuses a second `create`. */
const dialogs = new Map<string, Promise<string>>();

async function showDialog(id: string, html: string): Promise<void> {
  let handle = dialogs.get(id);
  if (handle === undefined) {
    handle = joplin.views.dialogs.create(id).then(async (h) => {
      await joplin.views.dialogs.setButtons(h, [{ id: "ok" }]);
      return h;
    });
    dialogs.set(id, handle);
  }
  const h = await handle;
  await joplin.views.dialogs.setHtml(h, `<div class="visimark-dialog">${html}</div>`);
  await joplin.views.dialogs.open(h);
}

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
