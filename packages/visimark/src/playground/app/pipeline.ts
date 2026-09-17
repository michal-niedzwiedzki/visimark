/**
 * The derived half of the page: `fmt` into TERMINAL, then eval/explain/preview
 * into KNOWLEDGE, REASONING and PREVIEW, all read from the *current* editor
 * buffer.
 *
 * On 0.5s of typing inactivity: clear TERMINAL, re-run `fmt`, fold its output
 * back into the editor, and refresh the rest from the corrected text.
 */

import type { FmtResult } from "../../write/fmt.js";
import type { PgEvalResult, VisiMarkApi } from "../browser-entry.js";
import type { FileStore } from "./store.js";
import type { Quest } from "./quest.js";
import type { Terminal } from "./terminal.js";
import { byId } from "./dom.js";

const EDIT_DEBOUNCE = 500;

export function pluralize(n: number, w: string): string {
  return `${n} ${w}${n === 1 ? "" : "s"}`;
}

export interface Pipeline {
  /** Mirrors `visimark fmt FILE` — prints outcome to TERMINAL. Does not touch
   *  the editor buffer itself; callers that want the corrected text apply
   *  `result.output` back to the editor. */
  runFmt(): FmtResult | null;
  /** Re-runs eval/explain/preview from the current buffer. */
  refreshDerived(): void;
  /** Sets the BUILD PASSING / BUILD FAILING flag. */
  setStatus(ok: boolean, note?: string): void;
  /** Mirrors `visimark check FILE`'s STALE findings for the current file. */
  hasStaleFindings(source: string): boolean;
  /** Cancels a debounced refresh that has not fired yet. */
  cancelPendingRefresh(): void;
  knowledgeText(): string;
}

export function createPipeline(
  VM: VisiMarkApi,
  cm: CodeMirrorEditor,
  store: FileStore,
  terminal: Terminal,
  quest: () => Quest,
): Pipeline {
  const knowledgeEl = byId("knowledge-body");
  const reasoningEl = byId("reasoning-body");
  const previewEl = byId("preview-body");
  const flagEl = byId("build-flag");
  const labelEl = byId("build-label");
  const metaEl = byId("build-meta");

  let editTimer: ReturnType<typeof setTimeout> | null = null;

  function setStatus(ok: boolean, note?: string): void {
    flagEl.className = `flag${ok ? "" : " fail"}`;
    labelEl.textContent = ok ? "BUILD PASSING" : "BUILD FAILING";
    metaEl.textContent = note ?? "";
  }

  function runFmt(): FmtResult | null {
    const current = store.current();
    const source = cm.getValue();
    terminal.cmd(`visimark fmt ${current}`);
    let result: FmtResult;
    try {
      // the reader too: `fmt` re-checks, and without it an imported sheet's
      // columns all read UNDEF and the STATUS bar goes red on a document the
      // CLI passes clean (review §4.3)
      result = VM.fmt(source, store.optsFor(current));
    } catch (e) {
      terminal.line(`visimark: ${(e as Error).message}`, "err");
      setStatus(false, "fmt crashed");
      terminal.trim();
      return null;
    }
    if (result.changed || result.artifacts.length > 0) {
      const bits: string[] = [];
      if (result.cellsUpdated) bits.push(pluralize(result.cellsUpdated, "cell"));
      if (result.anchorsUpdated) bits.push(pluralize(result.anchorsUpdated, "anchor"));
      if (result.datesFixed) bits.push(pluralize(result.datesFixed, "date"));
      if (result.artifacts.length) bits.push(pluralize(result.artifacts.length, "artifact"));
      terminal.line(`${current}: updated ${bits.join(", ")}`);
    } else {
      terminal.line(`${current}: unchanged`);
    }
    if (result.unfixable.length > 0) {
      terminal.line(VM.formatCheck(current, result.unfixable), "err");
    }
    setStatus(result.unfixable.length === 0);
    terminal.trim();
    return result;
  }

  /**
   * KNOWLEDGE is `eval --json` verbatim, but a chart's `svg` field is itself
   * the full rendered SVG document — shown for real in PREVIEW, it would just
   * be noise duplicated as an escaped JSON string here.
   */
  function redactSvg(key: string, value: unknown): unknown {
    if (key === "svg" && typeof value === "string") {
      return `<${value.length} bytes, rendered in Preview>`;
    }
    return value;
  }

  /**
   * There is no filesystem to render chart artifacts onto (`fmt --write` never
   * runs here), so a chart's SVG never lands at the `![...](path)` its anchor
   * names. `pgEval`'s `charts[]` carries the rendered SVG in memory regardless
   * — check() always builds it, it just can't compare it to a file without a
   * reader — so PREVIEW substitutes it into the matching <img> by hand.
   */
  function embedCharts(charts: PgEvalResult["charts"] | undefined): void {
    if (!charts || charts.length === 0) return;
    const svgByPath: Record<string, string> = {};
    for (const c of charts) {
      if (c.path && c.svg) svgByPath[c.path] = c.svg;
    }
    previewEl.querySelectorAll<HTMLImageElement>("img[src]").forEach((img) => {
      const svg = svgByPath[img.getAttribute("src") ?? ""];
      if (!svg) return;
      img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    });
  }

  function refreshDerived(): void {
    const current = store.current();
    const source = cm.getValue();
    let evalResult: PgEvalResult | null = null;

    try {
      evalResult = VM.pgEval(source, store.optsFor(current));
      knowledgeEl.textContent = JSON.stringify(evalResult, redactSvg, 2);
      const failed = evalResult.assertions.filter((a) => a.holds === false);
      if (failed.length > 0) {
        setStatus(false, `${pluralize(failed.length, "assertion")} failing`);
      }
      quest().checkEval(evalResult, source);
    } catch (e) {
      knowledgeEl.textContent = `error: ${(e as Error).message}`;
    }

    try {
      reasoningEl.textContent = VM.pgExplain(source, store.optsFor(current)).join("\n");
    } catch (e) {
      reasoningEl.textContent = `error: ${(e as Error).message}`;
    }

    try {
      previewEl.innerHTML = marked.parse(source);
      embedCharts(evalResult?.charts);
    } catch (e) {
      previewEl.textContent = `error: ${(e as Error).message}`;
    }
  }

  function onInactivity(): void {
    terminal.clear();
    const result = runFmt();
    if (result?.changed) {
      const cursor = cm.getCursor();
      cm.setValue(result.output);
      cm.setCursor(cursor);
      store.setText(store.current(), result.output);
      // A cell or anchor got rewritten — the visitor typed over a derived
      // value and fmt just overwrote it back. By the time refreshDerived()
      // below re-checks for STALE findings, this is already fixed (fmt just
      // fixed it), so that's the one place to catch "you edited a derived
      // value and got overwritten" as it happens rather than after the fact.
      if (result.cellsUpdated || result.anchorsUpdated) {
        quest().signal("action:fmt-corrected");
      }
    }
    if (result && result.unfixable.length === 0) quest().signal("action:fmt-clean");
    if (result && result.unfixable.length > 0) quest().signal("action:fmt-failing");
    refreshDerived();
  }

  cm.on("change", (_instance, change) => {
    if (change.origin === "setValue") return;
    store.setText(store.current(), cm.getValue());
    if (editTimer !== null) clearTimeout(editTimer);
    editTimer = setTimeout(onInactivity, EDIT_DEBOUNCE);
  });

  // Lockstep scroll: PREVIEW tracks EDITOR (and vice versa) by scroll
  // fraction, the same trick index.html's renderDemo() uses for its
  // source/preview panes — CodeMirror just has its own scroll API instead of a
  // plain scrollable element.
  let syncingScroll: string | null = null;
  cm.on("scroll", () => {
    if (syncingScroll && syncingScroll !== "editor") return;
    syncingScroll = "editor";
    const info = cm.getScrollInfo();
    const range = info.height - info.clientHeight;
    const ratio = range > 0 ? info.top / range : 0;
    previewEl.scrollTop = ratio * (previewEl.scrollHeight - previewEl.clientHeight);
    requestAnimationFrame(() => {
      syncingScroll = null;
    });
  });
  previewEl.addEventListener("scroll", () => {
    if (syncingScroll && syncingScroll !== "preview") return;
    syncingScroll = "preview";
    const range = previewEl.scrollHeight - previewEl.clientHeight;
    const ratio = range > 0 ? previewEl.scrollTop / range : 0;
    const info = cm.getScrollInfo();
    cm.scrollTo(null, ratio * (info.height - info.clientHeight));
    requestAnimationFrame(() => {
      syncingScroll = null;
    });
  });

  return {
    runFmt,
    refreshDerived,
    setStatus,
    /** Cheap enough to run a second time per keystroke-settle for a
     *  hand-typed document. */
    hasStaleFindings(source) {
      try {
        const current = store.current();
        const { findings } = VM.check(VM.build(VM.locate(source)), store.optsFor(current));
        return findings.some((f) => f.code === "STALE");
      } catch {
        return false;
      }
    },
    cancelPendingRefresh() {
      if (editTimer !== null) clearTimeout(editTimer);
    },
    knowledgeText: () => knowledgeEl.textContent ?? "",
  };
}
