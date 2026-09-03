import { beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { activateExtension, createHost, type Host } from "./host.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const repo = join(root, "..", "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const sample = join(repo, "docs", "example-invoice.md");

let host: Host;

beforeAll(async () => {
  host = createHost();
  await activateExtension(host);
});

test("every contributed command survives activation", () => {
  for (const c of pkg.contributes.commands) {
    expect(host.commands.has(c.command)).toBe(true);
  }
});

// The Command Palette lists every contributed command and calls it with no
// arguments. `explainSheet` and `fixSheet` are also CodeLens targets that get
// `(uri, sheetId)` — reading a URI out of `undefined` threw, and the host
// turned the rejection into an error dialog.
test("contributed commands do not throw when the palette calls them bare", async () => {
  for (const c of pkg.contributes.commands) {
    const run = host.commands.get(c.command)!;
    expect(run()).resolves.toBeDefined; // does not reject
    await run();
  }
});

test("the palette's bare commands say so when no Markdown file is open", async () => {
  host.messages.length = 0;
  await host.commands.get("visimark.explainSheet")!();
  expect(host.messages.join("\n")).toContain("Markdown");
});

// Without a sheet id, `explain` describes the whole document.
test("explain with no sheet id explains the active document", async () => {
  host.openFile(sample);
  await host.commands.get("visimark.explainSheet")!();
  const text = host.virtual("visimark-explain:example-invoice.md.txt");
  expect(text).toContain("#lines");
  expect(text).toContain("Net = Qty * Rate");
});

test("explain with a sheet id explains just that sheet", async () => {
  host.openFile(sample);
  const uri = `file://${sample}`;
  await host.commands.get("visimark.explainSheet")!(uri, "lines");
  const text = host.virtual("visimark-explain:lines.txt");
  expect(text).toContain("#lines");
  expect(text).not.toContain("#schedule");
});

// `editor.action.formatDocument` runs whatever `editor.defaultFormatter` names
// — Prettier, for most Markdown users — which reformats the prose and leaves
// every stale value untouched. VisiMark's own fix commands must go to
// VisiMark's formatter.
test("fixing stale values never delegates to the shared format command", async () => {
  host.openFile(sample);
  host.executed.length = 0;
  await host.commands.get("visimark.fixAllStale")!();
  await host.commands.get("visimark.fixSheet")!(`file://${sample}`, "lines");
  expect(host.executed).not.toContain("editor.action.formatDocument");
});

test("the bundle carries no reference to the shared format command", () => {
  const bundle = readFileSync(join(root, "dist", "extension.js"), "utf8");
  expect(bundle.includes("editor.action.formatDocument")).toBe(false);
});

// --- fix on save -----------------------------------------------------------

const FIX_ON_SAVE = "visimark.format.fixOnSave";
const MANUAL = 1;
const AFTER_DELAY = 2;

test("fixOnSave is contributed and starts on", () => {
  const setting = pkg.contributes.configuration.properties[FIX_ON_SAVE];
  expect(setting).toBeDefined();
  expect(setting.type).toBe("boolean");
  expect(setting.default).toBe(true);
});

// The manifest default and the code's fallback are two separate declarations
// of the same decision, and only the manifest one is visible in Settings.
// They drift silently: the extension reads its fallback when the setting is
// unset, which is exactly the case a user never configures.
test("the code's fallback agrees with the manifest default", async () => {
  host.config.delete(FIX_ON_SAVE);
  const doc = host.openFile(sample);
  const edits = await host.save(doc, MANUAL);
  const manifestDefault =
    pkg.contributes.configuration.properties[FIX_ON_SAVE].default;
  expect(edits.length > 0).toBe(manifestDefault);
});

// On by default: a stale document is the state the project exists to
// eliminate, and a save is when the author has finished the edit that caused
// it.
test("an unconfigured save is one VisiMark acts on", async () => {
  host.config.delete(FIX_ON_SAVE);
  const doc = host.openFile(sample);
  expect(await host.save(doc, MANUAL)).toHaveLength(1);
});

// Turning it off must genuinely stop the rewrite, not merely skip the prompt.
test("saving is left alone once fixOnSave is off", async () => {
  host.config.set(FIX_ON_SAVE, false);
  const doc = host.openFile(sample);
  expect(await host.save(doc, MANUAL)).toHaveLength(0);
});

// `files.autoSave` fires a save every few hundred milliseconds. Rewriting
// values then would move text under a cursor mid-edit, so — like
// `editor.formatOnSave` — an autosave is left alone.
test("autosave never rewrites values, even with fixOnSave on", async () => {
  host.config.set(FIX_ON_SAVE, true);
  const doc = host.openFile(sample);
  expect(await host.save(doc, AFTER_DELAY)).toHaveLength(0);
});

test("saving a file that is not Markdown is left alone", async () => {
  host.config.set(FIX_ON_SAVE, true);
  const doc = host.openFile(join(root, "package.json"));
  expect(await host.save(doc, MANUAL)).toHaveLength(0);
});

test("fixOnSave defers to visimark.enable", async () => {
  host.config.set(FIX_ON_SAVE, true);
  host.config.set("visimark.enable", false);
  const doc = host.openFile(sample);
  try {
    expect(await host.save(doc, MANUAL)).toHaveLength(0);
  } finally {
    host.config.delete("visimark.enable");
  }
});
