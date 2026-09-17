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
 * SCENARIO panel; a missing engine, a missing CodeMirror or a missing starting
 * document leaves nothing to work in, and stops with a named overlay.
 */

import type { Quest } from "./quest.js";
import type { FailedFile } from "./sources.js";
import type { Scenarios } from "./types.js";
import { TUTORIAL_CHAPTERS, loadFiles, loadScenarios } from "./sources.js";
import {
  FILE_PROTOCOL_DETAIL,
  FILE_PROTOCOL_MESSAGE,
  createBootOverlay,
  isFileProtocol,
  whenWideEnough,
} from "./boot.js";
import { byId, makeStatusFlasher } from "./dom.js";
import { createStore } from "./store.js";
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

  const { files, failed } = await loadFiles();

  // Lets a link point straight at a specific file (e.g. a tutorial chapter) —
  // falls back to demo.md when the param is absent or names a file that
  // doesn't exist.
  const requested = new URLSearchParams(window.location.search).get("file");
  const initial =
    requested && Object.prototype.hasOwnProperty.call(files, requested) ? requested : "demo.md";

  if (!Object.prototype.hasOwnProperty.call(files, initial)) {
    overlay.fail(
      "The playground could not load its documents",
      Object.keys(files).length === 0
        ? "None of the tutorial documents arrived. The server is reachable — this page " +
            "loaded — so the docs/playground/ directory is most likely missing or not being served."
        : `The starting document (${initial}) did not arrive, so there is nothing to open.`,
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
  cm.setValue(files[initial] ?? "");

  const store = createStore(VM, cm, files, initial);
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

  byId("editor-filename").textContent = initial;
  filesPanel.render();
  quest().render(initial);
  renderReference(VM);

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

  pipeline.runFmt();
  pipeline.refreshDerived();
  overlay.dismiss();
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
