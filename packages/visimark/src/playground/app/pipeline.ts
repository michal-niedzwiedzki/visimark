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

/**
 * How long typing has to stop before the pipeline runs — and the floor for it
 * (review §2.10).
 *
 * The review asked for this to be measured before anything was moved off the
 * main thread, and warned against assuming which phase dominates. Measured in
 * Chromium against a generated table, with the whole pass run from the page:
 *
 * | rows | source | fmt | pgEval | pgExplain | marked | innerHTML | pass |
 * |---:|---:|---:|---:|---:|---:|---:|---:|
 * | 50 | 2 KB | 3 | 3 | 5 | 0.3 | 2 | **12 ms** |
 * | 100 | 3 KB | 6 | 5 | 5 | 0.4 | 3 | **20 ms** |
 * | 500 | 16 KB | 50 | 45 | 47 | 1.6 | 13 | **155 ms** |
 * | 1000 | 31 KB | 224 | 215 | 201 | 2.7 | 23 | **666 ms** |
 * | 2000 | 64 KB | 613 | 808 | 791 | 4.9 | 46 | **2,262 ms** |
 *
 * Two things fall out of that, and both contradict a guess the review was
 * careful not to make.
 *
 * **Rendering is not the problem.** `marked.parse` never reaches 5 ms and
 * the preview write never reaches 50; together they are under 3% of the pass
 * at every size. Chart rendering does not appear because these documents
 * carry none, and a chart is bounded by its series, not by the table.
 *
 * **The cost is spread evenly across the engine calls, and each is
 * superlinear** — doubling the rows roughly quadruples the pass. `fmt`,
 * `pgEval` and `pgExplain` each locate, build and check the whole document
 * from scratch, and `hasStaleFindings` adds a *fourth* whenever a quest step
 * is watching for STALE — which is most of the time anyone is using the page,
 * so the table above undercounts. That is a real finding and it is *not*
 * fixed here: sharing one build across the four is an engine and API change,
 * which is the "belongs in a different review" case §2.10 names. It is now
 * tracked as a row in docs/vocabulary-catalogue.md §F rather than only as a
 * design doc; docs/design/playground-pipeline-cost-plan.md keeps the numbers.
 *
 * What ships here is the cheap half. A pass is timed, and the next debounce
 * is at least as long as the last pass took, so a document heavy enough to
 * lock the tab does it once per pause rather than continuously — the page
 * stays usable while typing instead of fighting itself. For everything the
 * playground actually holds (largest bundled document: 8 KB, 14 table rows)
 * this never leaves the 500 ms floor.
 */
const EDIT_DEBOUNCE = 500;

/** The pass cost past which the debounce stretches, and past which the page
 *  says out loud what it is doing rather than just feeling slow. */
const SLOW_PASS = 250;

/** Never wait longer than this, however expensive the document: past a few
 *  seconds the page stops looking busy and starts looking broken. */
const MAX_DEBOUNCE = 3000;

/**
 * How long to wait after the next keystroke, given what the last pass cost.
 *
 * A document heavy enough to lock the tab then locks it once per typing pause
 * instead of continuously, so the page stays usable while someone types in it
 * rather than fighting them for the thread.
 */
export function nextDebounce(lastPassMs: number): number {
  return Math.min(Math.max(EDIT_DEBOUNCE, lastPassMs), MAX_DEBOUNCE);
}

/**
 * What the last full pass over each document cost.
 *
 * **Keyed by file, and that is the whole point** (follow-up review §2.1). The
 * cost used to be one number and one "I have said this is slow" boolean, both
 * living for the lifetime of the pipeline: paste a 2,000-row table into
 * `demo.md`, open an 8 KB chapter, and the next keystroke there waited 2,262 ms
 * for a document that checks in twelve. The reverse missed too — switching
 * *into* a heavy document got one 500 ms pass that locked the tab, which is the
 * case the debounce was built for.
 *
 * A never-yet-measured file starts at 0, so it falls to the `EDIT_DEBOUNCE`
 * floor. That under-waits exactly once on a heavy document, and only when
 * nothing has measured it — which `runNow()` now does on every file switch, so
 * in practice a document is measured before its first keystroke rather than
 * after it. The alternative, seeding a new file with the last known cost of
 * *something else*, is the bug this replaces wearing a different hat.
 */
export interface PassCosts {
  /** What a pass over `name` last cost, or 0 for a document never measured. */
  costOf(name: string): number;
  /**
   * Records a measurement, and returns true the first time `name` is slow
   * enough to be worth explaining to the visitor.
   *
   * Once per document rather than once per session: the old one-shot said
   * "this document" about whichever document happened to be slow first, then
   * stayed silent while every later one waited three seconds with no
   * explanation at all. Still once per document, though — repeating it every
   * keystroke-settle would make the explanation into the noise.
   */
  record(name: string, ms: number): boolean;
}

export function createPassCosts(): PassCosts {
  const cost = new Map<string, number>();
  const explained = new Set<string>();
  return {
    costOf: (name) => cost.get(name) ?? 0,
    record(name, ms) {
      cost.set(name, ms);
      if (ms <= SLOW_PASS || explained.has(name)) return false;
      explained.add(name);
      return true;
    },
  };
}

export function pluralize(n: number, w: string): string {
  return `${n} ${w}${n === 1 ? "" : "s"}`;
}

/**
 * A rendered chart SVG, as something an `<img src>` will accept.
 *
 * This used to be `btoa(unescape(encodeURIComponent(svg)))` (review §2.12).
 * `unescape` is Annex B legacy and base64 costs a third of the payload, so the
 * replacement percent-encodes instead — but **only the characters that have
 * to be**, which is the part worth spelling out, because plain
 * `encodeURIComponent(svg)` is *worse* than the base64 it replaces. An SVG is
 * mostly `<`, `>`, `"`, `/` and spaces; escaping all of them costs three bytes
 * each. Measured on 12-charts.md's `order-spend.svg` (2,770 bytes raw):
 *
 * | encoding | data URI length |
 * |---|---|
 * | `btoa(unescape(…))`, before | 3,720 |
 * | `encodeURIComponent(svg)` | 4,167 |
 * | only what must be escaped | **2,829** |
 *
 * What must be escaped: `%` (or an existing escape is re-read), `#` (or the
 * rest of the document becomes a fragment identifier), and anything outside
 * printable ASCII — control characters because the URL parser strips ASCII
 * newlines and tabs out of a URL, which would silently run two words of a
 * chart label together, and non-ASCII because a data URI has no charset
 * parameter to interpret those bytes with. Everything else survives verbatim.
 *
 * **Not a `blob:` URL**, which would be smaller still. Every blob URL has to
 * be handed back with `URL.revokeObjectURL`, and this runs from
 * `refreshDerived()` on a 500ms typing debounce over a document that can hold
 * several charts — so a missed revoke is a leak that grows while you type,
 * not a theoretical one. A data URI is owned by the `<img>` and dies with it.
 *
 * The scheme is granted by `img-src 'self' data:` in playground.html's CSP
 * (review §2.6); `data:` and `blob:` are separate grants, so the two decisions
 * have to move together.
 */
export function svgDataUri(svg: string): string {
  const escaped = svg.replace(/[%#]|[^\x20-\x7E]/gu, (ch) => encodeURIComponent(ch));
  return `data:image/svg+xml,${escaped}`;
}

export interface Pipeline {
  /**
   * Mirrors `visimark fmt FILE` — prints outcome to TERMINAL. Does not touch
   * the editor buffer itself; callers that want the corrected text apply
   * `result.output` back to the editor.
   *
   * **Only the typing-settle does that, and that is policy rather than an
   * oversight.** `runPass()` below is the one writer; opening a file runs
   * `fmt` for its findings and applies nothing. Silently repairing a document
   * the moment it is opened would destroy the thing
   * `example-invoice-drift.md` exists to demonstrate — you would never see
   * the drift, only the page's correction of it. A visitor's own keystroke is
   * consent to the fix; clicking a filename is not.
   */
  runFmt(): FmtResult | null;
  /** Re-runs eval/explain/preview from the current buffer. */
  refreshDerived(): void;
  /**
   * Runs `fmt` and the derived panels over whatever is current *now*, and
   * records what the pass cost.
   *
   * The pair every non-typing path used to call by hand (a file switch, a
   * revert, "Infer and write"). Doing the work untimed is what left the
   * debounce sized from a document the visitor had already left — so the pair
   * is one call, and the measurement is not something a caller can forget.
   */
  runNow(): void;
  /** Sets the BUILD PASSING / BUILD FAILING flag. */
  setStatus(ok: boolean, note?: string): void;
  /** Mirrors `visimark check FILE`'s STALE findings for the current file. */
  hasStaleFindings(source: string): boolean;
  /** Cancels a debounced refresh that has not fired yet. */
  cancelPendingRefresh(): void;
  /** Registers a callback for the end of each typing-settle pass — where the
   *  visitor's buffer is saved (review §2.7), and so the moment anything
   *  showing "this file has been edited" has to catch up. */
  onSettled(fn: () => void): void;
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
  const settled: (() => void)[] = [];
  /** How long a full pass over each document took, which is what that
   *  document's next wait is sized against (review §2.10, follow-up §2.1). */
  const costs = createPassCosts();

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
      img.src = svgDataUri(svg);
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
      // **The preview is not a trust boundary, and here is the condition on
      // which that stops being true** (review §2.6).
      //
      // `source` is the CodeMirror buffer. Everything that can reach it today
      // is either the visitor's own typing or a document committed to this
      // repository and fetched from this origin — so unsanitized Markdown
      // here is self-XSS at worst, and sanitizing would cost the preview the
      // inline HTML that Markdown legitimately allows.
      //
      // It becomes a real boundary the moment a document reaches this buffer
      // from anywhere the visitor is not: a document in the URL, an import
      // from a gist, a paste target, a shared workspace, anything at all
      // authored by one person and rendered for another. Note that `?file=`
      // (review §2.8) is *not* that — it selects from FILE_SOURCES by name
      // and cannot carry content. If you are adding the feature that changes
      // this, the sanitizer goes in on the same commit, and the CSP above
      // stops being the only control.
      previewEl.innerHTML = marked.parse(source);
      embedCharts(evalResult?.charts);
    } catch (e) {
      previewEl.textContent = `error: ${(e as Error).message}`;
    }
  }

  /** Times `run` and files the result under the document it was run over.
   *  The name is read *before* the work, because a pass that ends on a
   *  different current file than it started on must not be charged to the
   *  newcomer. */
  function measure(run: () => void): void {
    const name = store.current();
    const started = performance.now();
    run();
    const ms = performance.now() - started;
    if (!costs.record(name, ms)) return;
    terminal.line(
      `playground: ${name} takes ${Math.round(ms)}ms to check, so the live update now ` +
        "waits that long after you stop typing in it — see §2.10 in " +
        "docs/design/playground-pipeline-cost-plan.md",
      "err",
    );
  }

  function onInactivity(): void {
    measure(runPass);
  }

  function runPass(): void {
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
    // The typing has stopped, so this is where the work is written through to
    // localStorage (review §2.7) rather than on every keystroke — the same
    // 500 ms settle the rest of this pass rides on.
    store.persist(store.current());
    for (const fn of settled) fn();
  }

  cm.on("change", (_instance, change) => {
    if (change.origin === "setValue") return;
    const current = store.current();
    store.setText(current, cm.getValue());
    if (editTimer !== null) clearTimeout(editTimer);
    // Sized from *this* document's last pass, not from whatever was open
    // before it.
    editTimer = setTimeout(onInactivity, nextDebounce(costs.costOf(current)));
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
    runNow() {
      measure(() => {
        runFmt();
        refreshDerived();
      });
    },
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
    onSettled(fn) {
      settled.push(fn);
    },
    knowledgeText: () => knowledgeEl.textContent ?? "",
  };
}
