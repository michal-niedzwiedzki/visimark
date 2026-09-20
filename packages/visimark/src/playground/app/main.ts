/**
 * The playground application's entry point — the bundle docs/playground.html
 * loads after ./vendor/visimark-browser.js.
 *
 * This file used to be 1,535 lines of `<script>` inside playground.html, where
 * no linter, typechecker, formatter or test in this repository could see it
 * (review §2.4). It is now ordinary TypeScript under packages/visimark/src,
 * built by `bun run --filter visimark build:playground` into a second
 * committed artifact in docs/vendor/ — which the `playground-bundle` CI job
 * already guards against drift, since it diffs the whole directory.
 *
 * **It reaches the engine through `window.VisiMark`, not through an import.**
 * A direct import would bundle the entire engine a second time, next to the
 * 288 KB copy browser-entry.ts already ships. The only thing crossing from
 * there is `import type { VisiMarkApi }`, which compiles away to nothing.
 *
 * playground.html loads this as a classic `<script>`, not a module, for the
 * same reason it loads the engine that way: `file://` blocks ES module imports
 * via CORS, and `bun build --format iife` has no notion of a module export.
 *
 * Wiring order below is load-bearing in one place: the pipeline is built
 * before the quest engine (it supplies the STALE check the quest engine reads)
 * and the quest engine is built before the panels that signal it. The `quest`
 * accessor is how the pipeline reaches forward across that one cycle.
 *
 * **Every failure between here and first render has a message** (review §2.1).
 * The rule for which ones are fatal: a partial boot is offered whenever what
 * is missing costs a feature, and refused when it costs the editor. So a
 * missing example document drops one row from FILES and says so in TERMINAL;
 * a missing scenarios.json costs the tutorial track and says so in the
 * SCENARIO panel; a malformed *step* costs one chapter's checklist and says so
 * there too (follow-up review §2.2 — it used to cost the whole page); a
 * missing engine, a missing CodeMirror or a missing starting document leaves
 * nothing to work in, and stops with a named overlay.
 */

import type { FileStore } from "./store.js";
import type { Terminal } from "./terminal.js";
import type { Quest } from "./quest.js";
import type { FailedFile } from "./sources.js";
import type { Scenarios } from "./types.js";
import {
  DATA_DEPENDENCIES,
  FILE_SOURCES,
  TUTORIAL_CHAPTERS,
  loadFiles,
  loadScenarios,
} from "./sources.js";
import {
  FILE_PROTOCOL_DETAIL,
  FILE_PROTOCOL_MESSAGE,
  createBootOverlay,
  isFileProtocol,
  whenWideEnough,
} from "./boot.js";
import { byId, makeStatusFlasher } from "./dom.js";
import type { BufferStore } from "./buffers.js";
import { createBufferStore } from "./buffers.js";
import { createStore } from "./store.js";
import { fileFromUrl, onUrlFileChange, writeFileToUrl } from "./url.js";
import { createTerminal } from "./terminal.js";
import { createPipeline } from "./pipeline.js";
import { createBadgeBoard } from "./badges.js";
import { createAgentPopover } from "./agents.js";
import { createQuest } from "./quest.js";
import { createTabs } from "./tabs.js";
import { createInferPanel } from "./infer.js";
import { createBuildPanel } from "./builder.js";
import { createFilesPanel } from "./files.js";
import { createKnowledgePanel } from "./knowledge.js";
import { renderReference } from "./reference.js";
import { wireCopyButton } from "./clipboard.js";

/** Names the CDN libraries the page cannot run without, so a blocked or
 *  failed `<script src>` is reported as itself rather than as a
 *  `ReferenceError` from the middle of the wiring. */
function missingGlobals(): string[] {
  const missing: string[] = [];
  if (typeof window.VisiMark === "undefined") missing.push("vendor/visimark-browser.js");
  if (typeof CodeMirror === "undefined") missing.push("CodeMirror (cdnjs.cloudflare.com)");
  if (typeof marked === "undefined") missing.push("marked (cdnjs.cloudflare.com)");
  return missing;
}

function describeFailures(failed: FailedFile[]): string {
  return failed.map((f) => `${f.path}: ${f.reason}`).join("\n");
}

async function boot(): Promise<void> {
  // Below 900px the page shows an interstitial instead of the playground (see
  // the .small-screen rules in docs/playground.html). Nothing here has
  // anything to render into, so nothing here runs — until the viewport gets
  // wide enough, which is how a dragged-open desktop window still works.
  await whenWideEnough();

  const overlay = createBootOverlay();

  if (isFileProtocol()) {
    overlay.fail("The playground needs a web server", FILE_PROTOCOL_MESSAGE, FILE_PROTOCOL_DETAIL);
    return;
  }

  const absent = missingGlobals();
  if (absent.length > 0) {
    overlay.fail(
      "The playground could not load its libraries",
      "These scripts did not arrive. Check the browser console for a network or " +
        "content-blocker error, and that docs/vendor/ was built " +
        "(`bun run --filter visimark build:playground`).",
      absent.join("\n"),
    );
    return;
  }
  const VM = window.VisiMark;

  // Constructed here rather than beside the store below, because resolving
  // `?file=` needs it: §2.7 restores files the visitor created and §2.8 writes
  // *every* current filename into the address bar, created ones included — but
  // boot resolved the parameter against FILE_SOURCES alone, so the page wrote
  // `?file=scratch.md` and then silently served demo.md on reload, rewriting
  // the bar on the way (follow-up review §2.5). `createdNames()` is a
  // synchronous localStorage read, so it costs nothing to ask this early.
  const buffers = createBufferStore(VM.sha256Hex);
  const created = new Set(buffers.createdNames());

  // Lets a link point straight at a specific file (e.g. a tutorial chapter) —
  // falls back to demo.md when the param is absent or names a file this
  // browser has never heard of.
  const requested = fileFromUrl();
  const initial =
    requested &&
    (Object.prototype.hasOwnProperty.call(FILE_SOURCES, requested) || created.has(requested))
      ? requested
      : "demo.md";

  // A file the visitor created has no path to fetch from — its saved text
  // *is* its text, and the store restores it below. Everything else is one
  // round trip for the page to become usable instead of twenty-one: just the
  // starting document and whatever its reader needs beside it.
  const bundled = Object.prototype.hasOwnProperty.call(FILE_SOURCES, initial);
  const { files, failed } = await loadFiles(
    bundled ? [initial, ...(DATA_DEPENDENCIES[initial] ?? [])] : [],
  );

  if (bundled && !Object.prototype.hasOwnProperty.call(files, initial)) {
    overlay.fail(
      "The playground could not load its documents",
      `The starting document (${initial}) did not arrive, so there is nothing to open. ` +
        "The server is reachable — this page loaded — so the docs/playground/ directory " +
        "is most likely missing or not being served.",
      describeFailures(failed),
    );
    return;
  }

  // Past this point the page can work, so nothing below is fatal on its own.
  let scenarios: Scenarios = {};
  let scenariosAvailable = true;
  let scenariosError = "";
  try {
    scenarios = await loadScenarios();
  } catch (e) {
    scenariosAvailable = false;
    // loadScenarios already names the path in its message.
    scenariosError = (e as Error).message;
  }

  const cm = CodeMirror.fromTextArea(byId<HTMLTextAreaElement>("editor-ta"), {
    mode: "gfm",
    lineNumbers: true,
    lineWrapping: true,
    viewportMargin: Infinity,
    theme: "default",
  });

  // The store, not boot, puts the first document into the editor: it is the
  // thing that knows whether the visitor has a saved copy of it from a
  // previous session (review §2.7).
  const store = createStore(VM, cm, buffers, files, initial);
  const terminal = createTerminal();

  let questRef: Quest | null = null;
  const quest = (): Quest => {
    if (!questRef) throw new Error("the quest engine was used before boot finished");
    return questRef;
  };

  const pipeline = createPipeline(VM, cm, store, terminal, quest);
  const badges = createBadgeBoard(scenarios, TUTORIAL_CHAPTERS, () => store.current());

  const flashKnowledgeStatus = makeStatusFlasher(byId("knowledge-status"));
  const showAgentPopover = createAgentPopover(flashKnowledgeStatus);

  questRef = createQuest({
    scenarios,
    scenariosAvailable,
    badges,
    hasStale: (source) => pipeline.hasStaleFindings(source),
    documentText: () => cm.getValue(),
    showAgentPopover,
    knowledgeText: () => pipeline.knowledgeText(),
    report: (message) => terminal.line(`playground: ${message}`, "err"),
  });

  const tabs = createTabs((action) => quest().signal(action));
  const inferPanel = createInferPanel(VM, cm, store, terminal, pipeline, quest);
  createBuildPanel(VM, store, terminal, pipeline, quest);
  createKnowledgePanel(pipeline, flashKnowledgeStatus, showAgentPopover);
  const filesPanel = createFilesPanel(cm, store, terminal, pipeline, tabs, inferPanel, quest);

  wireCopyButton(
    byId("reasoning-copy-btn"),
    makeStatusFlasher(byId("reasoning-status")),
    byId("reasoning-body"),
  );
  wireCopyButton(
    byId("infer-copy-btn"),
    makeStatusFlasher(byId("infer-status")),
    inferPanel.bodyEl,
  );

  pipeline.onSettled(() => {
    filesPanel.refreshDirty();
  });

  filesPanel.setEditorName(initial);
  filesPanel.render();
  quest().render(initial);
  renderReference(VM);

  // The address bar names what is on screen from the first paint, not only
  // after the first file switch (review §2.8) — so a link copied straight off
  // a fresh load is already the link to this chapter.
  writeFileToUrl(initial);
  onUrlFileChange((name) => {
    void filesPanel.switchTo(name);
  });

  // TERMINAL is the page's existing place for "a command had something to say"
  // — the non-fatal boot failures belong there, above the first `visimark fmt`
  // line, rather than in a banner of their own.
  for (const f of failed) {
    terminal.line(
      `playground: ${f.path} did not load (${f.reason}) — ${f.name} is not in FILES`,
      "err",
    );
  }
  if (!scenariosAvailable) {
    terminal.line(`playground: ${scenariosError} — no scenarios, quests or badges`, "err");
  }
  reportDiscarded(buffers, terminal);
  reportBlockedImages(terminal);

  pipeline.runFmt();
  pipeline.refreshDerived();
  overlay.dismiss();

  // Everything else, once the page is interactive and the browser is idle.
  // This is what keeps §2.5 from trading one problem for another: the first
  // paint is gated on one document, and by the time anyone reaches for BUILD
  // or a second chapter the rest has usually arrived anyway, with no spinner
  // and nothing blocked on it.
  prefetchRest(store, buffers, terminal);
}

/**
 * Says so when a saved copy is thrown away because the document it was edited
 * from has changed since (review §2.7).
 *
 * Silence here would be the playground doing the exact thing it exists to
 * catch: replacing someone's content without saying that it no longer matches
 * its source.
 */
function reportDiscarded(buffers: BufferStore, terminal: Terminal): void {
  const discarded = buffers.discarded();
  if (discarded.length === 0) return;
  terminal.line(
    `playground: ${discarded.join(", ")} changed in this release — your saved edits to ` +
      `${discarded.length === 1 ? "it were" : "them were"} discarded`,
    "err",
  );
}

/**
 * Says, once, when the page's own CSP blocks something the visitor typed.
 *
 * `img-src 'self' data:` is a closed allowlist, and it stays closed — the
 * playground's documents are all local, and a remote image in a demo editor is
 * a tracking vector pointed at whoever opens a shared document
 * (docs/design/playground-csp-plan.md). But that turns ordinary Markdown —
 * `![](https://example.com/logo.png)`, in an editor whose whole point is
 * typing Markdown into it — into a broken image, a console violation and no
 * explanation at all (follow-up review §2.12).
 *
 * So the constraint says itself, at the moment it bites, in the panel where
 * the page says everything else. Once per session: a document with thirty
 * remote images would otherwise fill TERMINAL with thirty copies of the same
 * sentence.
 */
function reportBlockedImages(terminal: Terminal): void {
  let said = false;
  window.addEventListener("securitypolicyviolation", (e) => {
    if (e.effectiveDirective !== "img-src" || said) return;
    said = true;
    terminal.line(
      "playground: this page blocks remote images, so the preview renders local documents " +
        "only — the Markdown is fine, the picture just will not load here",
      "err",
    );
  });
}

/**
 * Fetches the remaining documents off the critical path.
 *
 * `requestIdleCallback` is not in Safari before 17, so a timeout stands in —
 * the deadline does not need to be precise, only after first paint.
 */
function prefetchRest(store: FileStore, buffers: BufferStore, terminal: Terminal): void {
  const start = (): void => {
    void store.ensureAll().then((failed) => {
      for (const f of failed) {
        terminal.line(`playground: ${f.path} did not load (${f.reason})`, "err");
      }
      // Most documents are checked against their saved copy here rather than
      // at boot, so this is where most of the discards surface.
      reportDiscarded(buffers, terminal);
    });
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(start, { timeout: 4000 });
  } else {
    window.setTimeout(start, 1500);
  }
}

/**
 * The one place a boot failure can still reach. Anything thrown by the wiring
 * above is a bug rather than a missing resource, so it says so, and says where
 * to look — but it says it on the page instead of rejecting into the void the
 * way this file's predecessor did.
 */
void boot().catch((e: unknown) => {
  createBootOverlay().fail(
    "The playground failed to start",
    "This is a bug in the playground itself rather than a missing file. The browser " +
      "console has the stack trace.",
    (e as Error)?.stack ?? String(e),
  );
});
