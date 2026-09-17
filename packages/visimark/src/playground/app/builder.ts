/**
 * The BUILD tab: `visimark check` run across every file in FILES, the way a CI
 * job would check a whole repository — button-activated rather than on every
 * keystroke, since it is every open document, not just the current one.
 */

import type { VisiMarkApi } from "../browser-entry.js";
import type { FileStore } from "./store.js";
import type { Pipeline } from "./pipeline.js";
import type { Quest } from "./quest.js";
import type { Terminal } from "./terminal.js";
import { byId } from "./dom.js";
import { pluralize } from "./pipeline.js";

interface Outcome {
  ok: boolean;
  note: string;
  detail?: string;
}

export function createBuildPanel(
  VM: VisiMarkApi,
  store: FileStore,
  terminal: Terminal,
  pipeline: Pipeline,
  quest: () => Quest,
): void {
  const btn = byId<HTMLButtonElement>("build-btn");
  const statusEl = byId("build-status");
  const bodyEl = byId("build-body");

  /** Mirrors `visimark check FILE` — findings plus, since `check` alone
   *  doesn't fail the exit code on a false assertion (see cmdEval's separate
   *  reportFailures), a failed assertion also counts here. */
  function checkOne(name: string, source: string): Outcome {
    try {
      const result = VM.check(VM.build(VM.locate(source)), store.optsFor(name));
      const failedAssertions = result.assertions.filter((a) => a.holds === false);
      if (result.exitCode === 0 && failedAssertions.length === 0) {
        return { ok: true, note: "clean" };
      }
      const bits: string[] = [];
      if (result.findings.length) bits.push(pluralize(result.findings.length, "finding"));
      if (failedAssertions.length) {
        bits.push(pluralize(failedAssertions.length, "failed assertion"));
      }
      return {
        ok: false,
        note: bits.join(", "),
        detail: VM.formatCheck(name, result.findings),
      };
    } catch (e) {
      return { ok: false, note: "crashed", detail: (e as Error).message };
    }
  }

  function buildRow(name: string, outcome: Outcome): DocumentFragment {
    const wrap = document.createDocumentFragment();
    const row = document.createElement("div");
    row.className = "build-row";
    const dot = document.createElement("span");
    dot.className = `flag${outcome.ok ? "" : " fail"}`;
    const fileEl = document.createElement("span");
    fileEl.className = "build-file";
    fileEl.textContent = name;
    const noteEl = document.createElement("span");
    noteEl.className = "build-note";
    noteEl.textContent = `— ${outcome.note}`;
    row.appendChild(dot);
    row.appendChild(fileEl);
    row.appendChild(noteEl);
    wrap.appendChild(row);
    if (!outcome.ok && outcome.detail) {
      const detail = document.createElement("pre");
      detail.className = "build-detail";
      detail.textContent = outcome.detail;
      wrap.appendChild(detail);
    }
    return wrap;
  }

  btn.addEventListener("click", () => {
    store.flush();
    btn.disabled = true;
    statusEl.textContent = "running…";
    bodyEl.innerHTML = "";
    // Data files (13-imports.csv) are in the store for the engine to read, not
    // for `visimark check` to run over — a CSV is not a VisiMark document and
    // the CLI would refuse it.
    const documents = store.names().filter((name) => /\.md$/i.test(name));
    terminal.cmd(`visimark check ${documents.join(" ")}`);

    let passed = 0;
    for (const name of documents) {
      const outcome = checkOne(name, store.text(name) ?? "");
      if (outcome.ok) passed++;
      bodyEl.appendChild(buildRow(name, outcome));
    }

    const summary = `${passed}/${documents.length} files passing`;
    statusEl.textContent = summary;
    terminal.line(`visimark check: ${summary}`);
    terminal.trim();
    const allPassed = passed === documents.length;
    pipeline.setStatus(allPassed, allPassed ? "" : summary);
    btn.disabled = false;
    quest().signal("action:build-run");
    const current = store.current();
    if (checkOne(current, store.text(current) ?? "").ok) {
      quest().signal(`action:build-pass:${current}`);
    }
  });
}
