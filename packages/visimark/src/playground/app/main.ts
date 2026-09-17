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
 */

import type { Quest } from "./quest.js";
import { TUTORIAL_CHAPTERS, loadFiles, loadScenarios } from "./sources.js";
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

async function boot(): Promise<void> {
  const VM = window.VisiMark;

  const files = await loadFiles();
  const scenarios = await loadScenarios();

  // Lets a link point straight at a specific file (e.g. a tutorial chapter) —
  // falls back to demo.md when the param is absent or names a file that
  // doesn't exist.
  const requested = new URLSearchParams(window.location.search).get("file");
  const initial =
    requested && Object.prototype.hasOwnProperty.call(files, requested) ? requested : "demo.md";

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
  pipeline.runFmt();
  pipeline.refreshDerived();
}

void boot();
