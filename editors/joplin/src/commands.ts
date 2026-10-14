import type { Explanation } from "visimark-editor-shared/explain.js";
import { escape } from "./html.js";
import { MESSAGES, applied, withImports } from "./messages.js";
import { FindingsPanel } from "./panel.js";
import {
  EDITOR_COMMANDS,
  type ApplyReply,
  type EvaluateReply,
  type ExplainReply,
  type FormatReply,
  type InferPreviewReply,
  type InsertTemplateReply,
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
  readonly execute: (...args: unknown[]) => Promise<void>;
}

/** One panel for the plugin's life, made when the commands are registered. */
let panel = new FindingsPanel();

/**
 * The starter templates, one command each. The ids and titles are spec
 * §2.3's; the template ids are the shared templates' own.
 */
const TEMPLATE_COMMANDS = [
  { id: "invoice", name: "visimark.insertInvoiceTemplate", title: "invoice" },
  { id: "budget", name: "visimark.insertBudgetTemplate", title: "monthly budget" },
  { id: "capacity", name: "visimark.insertCapacityTemplate", title: "team capacity" },
  { id: "experiment", name: "visimark.insertExperimentTemplate", title: "experiment log" },
] as const;

export const COMMANDS: readonly PaletteCommand[] = [
  { name: "visimark.check", label: "VisiMark: Check this note", execute: checkNote },
  { name: "visimark.format", label: "VisiMark: Format this note", execute: formatNote },
  { name: "visimark.evaluate", label: "VisiMark: Evaluate this note", execute: evaluateNote },
  { name: "visimark.explain", label: "VisiMark: Explain this value", execute: explainValue },
  { name: "visimark.infer", label: "VisiMark: Infer the formulas", execute: inferFormulas },
  ...TEMPLATE_COMMANDS.map((t) => ({
    name: t.name,
    label: `VisiMark: Insert ${t.title} template`,
    execute: () => insertTemplate(t.id),
  })),
  {
    name: "visimark.toggleFindings",
    label: "VisiMark: Show findings panel",
    execute: () => panel.toggle(),
  },
  {
    name: "visimark.sweep",
    label: "VisiMark: Sweep this notebook",
    // the notebook context menu passes the folder it was opened on
    execute: (folderId?: unknown) =>
      panel.sweep(typeof folderId === "string" ? folderId : undefined),
  },
];

export async function registerCommands(): Promise<void> {
  panel = new FindingsPanel();
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
  await joplin.views.menuItems.create(
    "visimark.sweep.folder",
    "visimark.sweep",
    "folderContextMenu",
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

/**
 * Check opens the findings panel on the selected note (#384 spec §2.5). It
 * reads the saved body, so it works in either editor: read-only Check in the
 * Rich Text editor.
 */
function checkNote(): Promise<void> {
  return panel.showNote();
}

async function formatNote(): Promise<void> {
  // off by default, like `visimark fmt` without `--fix-dates`
  const fixDates = (await joplin.settings.value("fixDatesOnFormat")) === true;
  const reply = await inEditor<FormatReply>(EDITOR_COMMANDS.format, { fixDates });
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
 * Infer: the preview in a dialog, then **Apply** sends the edits back with
 * the preview's version, and the content script refuses them if the note
 * moved in between (A1). With nothing to propose, the dialog says so with OK
 * only. Not gated on a block, same as Obsidian.
 */
async function inferFormulas(): Promise<void> {
  const preview = await inEditor<InferPreviewReply>(EDITOR_COMMANDS.inferPreview);
  if (preview === null) return;
  if (preview.kind === "failed") return say(MESSAGES.F2);
  const added = preview.edits
    .filter((e) => e.text.trim() !== "")
    .map((e) => `<pre>${escape(e.text.trim())}</pre>`)
    .join("");
  // the description says nothing written is changed; a deleted comment is
  // the one exception, so it is named, as Obsidian's dialog names it
  const marker = preview.removesMarker
    ? `<p>${escape(
        "This table already said it had no formulas to check. That comment will be removed, since it now does.",
      )}</p>`
    : "";
  const html = `<p>${escape(preview.description)}</p>${preview.empty ? "" : added + marker}`;
  if (preview.empty) {
    await showDialog("visimark.infer", html, [{ id: "ok" }]);
    return;
  }
  const choice = await showDialog("visimark.infer", html, [
    // `confirm` is one of Joplin's submit ids, so Enter applies
    { id: "confirm", title: "Apply" },
    { id: "cancel", title: "Cancel" },
  ]);
  if (choice !== "confirm") return;
  const reply = await inEditor<ApplyReply>(EDITOR_COMMANDS.apply, {
    version: preview.version,
    edits: preview.edits,
  });
  if (reply === null) return;
  if (reply.kind === "changed") return say(MESSAGES.A1);
  if (reply.kind === "failed") return say(MESSAGES.F2);
}

async function insertTemplate(id: string): Promise<void> {
  const reply = await inEditor<InsertTemplateReply>(EDITOR_COMMANDS.insertTemplate, { id });
  if (reply === null) return;
  if (reply.kind === "has-block") return say(MESSAGES.T1);
  if (reply.kind === "no-place") return say(MESSAGES.T2);
  if (reply.kind === "failed") return say(MESSAGES.F2);
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

/** Shows `html` and answers the id of the button that closed the dialog. */
async function showDialog(
  id: string,
  html: string,
  buttons: { id: string; title?: string }[] = [{ id: "ok" }],
): Promise<string> {
  let handle = dialogs.get(id);
  if (handle === undefined) {
    handle = joplin.views.dialogs.create(id);
    dialogs.set(id, handle);
  }
  const h = await handle;
  await joplin.views.dialogs.setButtons(h, buttons);
  await joplin.views.dialogs.setHtml(h, `<div class="visimark-dialog">${html}</div>`);
  // a dialog dismissed without a button may answer nothing: treat it as Cancel
  const result = (await joplin.views.dialogs.open(h)) as { id: string } | null;
  return result?.id ?? "";
}
