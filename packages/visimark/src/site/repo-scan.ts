/**
 * "Scan your repo" widget on the homepage: paste a public `owner/repo`,
 * fetch its tracked Markdown straight from GitHub's API (no clone, no
 * server — `raw.githubusercontent.com` and `api.github.com` both send
 * permissive CORS headers), run the same `infer`/`check` the CLI ships
 * against it in the browser, and offer a link that hands off to GitHub's
 * own "create new file" editor to add the VisiMark Action — nothing here
 * ever commits or opens a PR itself.
 *
 * The engine (`vendor/visimark-browser.js`, ~300KB minified) is not fetched
 * until the form is submitted, via a dynamically injected `<script>` tag —
 * it's an IIFE bundle, not a module, so `import()` can't load it (see
 * `../playground/browser-entry.ts`'s header comment for why the playground
 * bundle is built that way; this page's copy is the same build). Every
 * visit that doesn't use the widget pays nothing for it.
 */
import type { VisiMarkApi } from "../playground/browser-entry.js";
import { byId, escapeHtml } from "./dom.js";

const API = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";
const ENGINE_SRC = "vendor/visimark-browser.js";
/** Last known-good release, used only if the live lookup below fails. */
const FALLBACK_TAG = "v0.1.10";
/** Repos larger than this many Markdown files get the first N (in the git
 *  tree's own order — not sorted by anything meaningful) scanned and a note
 *  that the rest were skipped, as a last-resort guard against a truly
 *  pathological repo. Set well above what a normal docs-heavy repo carries:
 *  this project's own repo has 206 after dot-paths are excluded, and a cap
 *  anywhere near that silently drops real content in tree order — which is
 *  roughly alphabetical, so `docs/example-*.md` loses to `docs/design/*.md`
 *  first. raw.githubusercontent.com has no per-scan rate limit that a few
 *  hundred small text fetches would hit. */
const MAX_FILES = 500;
const CONCURRENCY = 6;
/** One retry, after a short pause, for a raw-content fetch that failed —
 *  covers a transient network blip or a momentary throttle on one request
 *  out of a few hundred, which used to take down the whole scan (a single
 *  rejected `fetch()` propagated uncaught through the pool). */
const RETRY_DELAY_MS = 400;

/** Mirrors `scripts/repo-scan-lib.ts`'s `VISIMARK_ACTION_USE` — kept as a
 *  separate copy because that module is Bun/Node CLI code and this one is a
 *  browser bundle; if VisiMark ever publishes the Action under a different
 *  name, both copies need the update. */
export const VISIMARK_ACTION_USE = /^\s*-?\s*uses:\s*[\w.-]+\/visimark(@|\/|\s|$)/im;

/** Mirrors `scripts/repo-scan-lib.ts`'s `excludeDotPaths` — same reasoning,
 *  same "why a separate copy" as `VISIMARK_ACTION_USE` above: dot-directory
 *  content (`.github/`, `.agents/`, a repo's own tooling) isn't the authored
 *  Markdown this widget exists to find arithmetic in. */
export function isDotPath(path: string): boolean {
  return path.split("/").some((segment) => segment.startsWith("."));
}

export interface RepoRef {
  owner: string;
  repo: string;
}

export function parseRepoInput(input: string): RepoRef | null {
  const trimmed = input.trim();
  const url = trimmed.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?(?:[/#?].*)?$/i,
  );
  if (url) return { owner: url[1]!, repo: url[2]! };
  const shorthand = trimmed.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (shorthand) return { owner: shorthand[1]!, repo: shorthand[2]! };
  return null;
}

interface GitTreeEntry {
  path: string;
  type: string;
}

/** Runs `fn` over `items` with at most `limit` in flight at once, so a
 *  100-file repo doesn't open 100 simultaneous connections. */
export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length });
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function loadEngine(): Promise<VisiMarkApi> {
  if (typeof window.VisiMark !== "undefined") return Promise.resolve(window.VisiMark);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = ENGINE_SRC;
    script.onload = () => {
      if (typeof window.VisiMark !== "undefined") resolve(window.VisiMark);
      else reject(new Error("visimark-browser.js loaded but did not set window.VisiMark"));
    };
    script.onerror = () => reject(new Error(`could not load ${ENGINE_SRC}`));
    document.head.appendChild(script);
  });
}

/** No `fetch()` below is awaited without this. A stuck request — a slow
 *  network, or a browser extension that intercepts and never resolves it —
 *  used to hang the whole scan indefinitely with no way out: the status line
 *  would report the scanning loop itself as finished while `Promise.all`
 *  still sat waiting on one more fetch that was never going to settle, which
 *  is exactly the "spinner still spinning after it says done" symptom this
 *  fixes. `AbortController` guarantees every fetch this widget makes settles
 *  one way or another within `timeoutMs`. */
function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function latestVisimarkTag(): Promise<string> {
  try {
    const res = await fetchWithTimeout(
      `${API}/repos/michal-niedzwiedzki/visimark/releases/latest`,
      5000,
    );
    if (!res.ok) return FALLBACK_TAG;
    const json = (await res.json()) as { tag_name?: string };
    return json.tag_name ?? FALLBACK_TAG;
  } catch {
    return FALLBACK_TAG;
  }
}

export function workflowYaml(defaultBranch: string, actionTag: string): string {
  return `name: visimark

on:
  push:
    branches: [${defaultBranch}]
  pull_request:

permissions:
  contents: read

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: michal-niedzwiedzki/visimark@${actionTag}
`;
}

export function githubNewFileUrl(ref: RepoRef, defaultBranch: string, content: string): string {
  const params = new URLSearchParams({
    filename: ".github/workflows/visimark.yml",
    value: content,
    message: "Add VisiMark check",
  });
  return `https://github.com/${ref.owner}/${ref.repo}/new/${defaultBranch}?${params.toString()}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Races `promise` against a timer, so the caller can never be stuck waiting
 * forever on it — no matter the reason: every individual `fetch()` this
 * widget makes already has its own timeout (`fetchWithTimeout`), but this is
 * the backstop over the *whole* scan for a cause neither of us has pinned
 * down after several rounds of narrowing it (a browser-specific stall in
 * `setTimeout`-based yielding, an extension interfering with the page, or a
 * class of hang the per-file/per-fetch guards don't cover). It's the honest
 * fix at this point: guarantee recovery, rather than keep chasing individual
 * leaks one at a time. The loser keeps running in the background — harmless,
 * since nothing it produces is used once its result arrives too late to
 * matter — this only ever changes what the *UI* waits for.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new ScanError(message)), ms)),
  ]);
}

/** Fetches `path`'s raw content, tolerating exactly the failures a scan of a
 *  few hundred files will occasionally hit: a rejected `fetch()` (network
 *  blip, momentary CORS hiccup on a throttled response) or a non-2xx status.
 *  One retry after `RETRY_DELAY_MS`; `null` (not `""`) on a second failure,
 *  so the caller can tell "couldn't fetch this one" from "this file is
 *  genuinely empty" and skip it rather than silently scoring it as clean. */
export async function fetchRawText(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await delay(RETRY_DELAY_MS);
    try {
      const res = await fetchWithTimeout(url, 20_000);
      if (res.ok) return await res.text();
    } catch {
      // network error, timeout, or CORS failure on a throttled response —
      // retry once
    }
  }
  return null;
}

interface FileResult {
  path: string;
  /** `formatCheck`'s full text — every finding, not just problems, since its
   *  own footer ("N problems (M stale, K errors)") is what the CLI and the
   *  GitHub Action itself print. */
  findingsText: string;
  /** Findings that would fail `check` — `VM.isProblem`, not the raw finding
   *  count. A document can carry `WARN`/`NOTE` advice with nothing actually
   *  wrong; showing that as a "finding" buried the real drift (issue: the
   *  homepage's own flagship stale-invoice demo has to be found among noise
   *  from files that merely lack `infer`'s advisory annotations). */
  problemCount: number;
}

/** Thrown for anything the status line should show verbatim — a 404, a rate
 *  limit, an empty repo. Distinguishes "GitHub said no" from a bug. */
class ScanError extends Error {}

async function fetchJson(url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchWithTimeout(url, 15_000);
  } catch (err) {
    throw new ScanError(
      `Could not reach GitHub (${err instanceof Error ? err.message : "network error"}).`,
    );
  }
  if (res.status === 403) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      throw new ScanError(
        "GitHub's unauthenticated API limit (60 requests/hour) is used up for this network — try again later.",
      );
    }
  }
  if (res.status === 404) throw new ScanError("Repo not found (or private).");
  if (!res.ok) throw new ScanError(`GitHub API error: ${res.status} ${res.statusText}`);
  return res.json();
}

async function runScan(
  ref: RepoRef,
  onProgress: (message: string, fraction: number | null) => void,
): Promise<{
  defaultBranch: string;
  hasAction: boolean;
  files: FileResult[];
  skipped: number;
  failed: number;
  crashed: number;
}> {
  onProgress(`Resolving ${ref.owner}/${ref.repo}…`, null);
  const repoInfo = (await fetchJson(`${API}/repos/${ref.owner}/${ref.repo}`)) as {
    default_branch: string;
  };
  const defaultBranch = repoInfo.default_branch;

  const tree = (await fetchJson(
    `${API}/repos/${ref.owner}/${ref.repo}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`,
  )) as { tree: GitTreeEntry[] };

  const raw = (path: string) =>
    fetchRawText(`${RAW}/${ref.owner}/${ref.repo}/${defaultBranch}/${path}`);

  const workflowEntries = tree.tree.filter(
    (e) => e.type === "blob" && /^\.github\/workflows\/.*\.ya?ml$/.test(e.path),
  );
  const workflowTexts = await mapPool(workflowEntries, CONCURRENCY, (e) => raw(e.path));
  const hasAction = workflowTexts.some((t) => t !== null && VISIMARK_ACTION_USE.test(t));
  if (hasAction) return { defaultBranch, hasAction, files: [], skipped: 0, failed: 0, crashed: 0 };

  const allMdEntries = tree.tree.filter(
    (e) => e.type === "blob" && /\.(md|markdown)$/i.test(e.path) && !isDotPath(e.path),
  );
  const mdEntries = allMdEntries.slice(0, MAX_FILES);
  const skipped = allMdEntries.length - mdEntries.length;

  onProgress(`Fetching ${mdEntries.length} file(s)…`, 0);
  const contents = new Map<string, string>();
  let fetched = 0;
  let failed = 0;
  await mapPool(mdEntries, CONCURRENCY, async (e) => {
    const text = await raw(e.path);
    if (text === null) failed++;
    else contents.set(e.path, text);
    fetched++;
    onProgress(
      `Fetching ${mdEntries.length} file(s)… (${fetched}/${mdEntries.length})`,
      fetched / mdEntries.length,
    );
  });

  onProgress("Loading engine…", null);
  const VM = await loadEngine();
  const reader = VM.memoryReader((path) => contents.get(path));
  const files: FileResult[] = [];
  let crashed = 0;
  let scanned = 0;
  for (const entry of mdEntries) {
    const source = contents.get(entry.path);
    if (source !== undefined) {
      // A malformed or unusual document from a repo VisiMark has never seen
      // is exactly the case a public "paste any repo" widget has to expect —
      // one bad file must not take the whole scan down with it (see the
      // fetch-side `fetchRawText` for the same principle on the network side).
      try {
        const model = VM.build(VM.locate(source));
        const result = VM.check(model, { doc: { path: entry.path, reader } });
        // COVERAGE ("this table has no vmark rules yet — infer them, or mark
        // it no-formulas") isn't an arithmetic fault, it's "you haven't
        // adopted VisiMark here yet." It's the right thing for `check` in CI
        // to enforce once a repo has opted in, but reporting it to someone
        // who just pasted their repo out of curiosity reads as "your table
        // has a problem" when the honest message is "nothing has been wrong
        // yet, because nothing here is being checked" — noise that competes
        // with, and can bury, an actual STALE/DATE/UNDEF finding. Excluded
        // from both the count and the detail text below.
        const relevantFindings = result.findings.filter((f) => f.code !== "COVERAGE");
        const problemCount = relevantFindings.filter(VM.isProblem).length;
        if (problemCount > 0) {
          files.push({
            path: entry.path,
            findingsText: VM.formatCheck(entry.path, relevantFindings),
            problemCount,
          });
        }
      } catch {
        crashed++;
      }
    }
    scanned++;
    // Every 5 files, *and* unconditionally on the last one — a fixed interval
    // that doesn't divide `mdEntries.length` (20 vs. this repo's 206) meant
    // the final stretch ran with no further UI update at all until the loop
    // fully ended: indistinguishable from a hang if anything in that tail is
    // even a little slower than expected (a different JS engine's regex
    // performance, a busy tab, GC). The `=== mdEntries.length` guard is what
    // actually fixes that — a finer interval alone would still leave *some*
    // remainder silent, just a shorter one.
    if (scanned % 5 === 0 || scanned === mdEntries.length) {
      onProgress(`Scanning… (${scanned}/${mdEntries.length})`, scanned / mdEntries.length);
      await delay(0);
    }
  }
  // No separate "done" message: the caller hides the whole status line the
  // moment this promise (and the parallel tag lookup, now timeout-bounded
  // too) settles, so a synthetic "done" step here only added a state where
  // the text says finished while the spinner, correctly, has not stopped yet.
  return { defaultBranch, hasAction, files, skipped, failed, crashed };
}

function renderReport(
  reportEl: HTMLElement,
  ref: RepoRef,
  outcome: Awaited<ReturnType<typeof runScan>>,
  addActionUrl: string | null,
): void {
  const { hasAction, files, skipped, failed, crashed } = outcome;
  const parts: string[] = [];

  if (hasAction) {
    parts.push(
      `<p class="repo-scan-summary">${escapeHtml(`${ref.owner}/${ref.repo}`)} already runs the VisiMark Action — nothing to add.</p>`,
    );
  } else {
    const totalProblems = files.reduce((n, f) => n + f.problemCount, 0);
    const caveats = [
      skipped > 0 ? `stopped after ${MAX_FILES} files; ${skipped} more weren't scanned` : "",
      failed > 0 ? `${failed} file(s) couldn't be fetched and were skipped — try again?` : "",
      crashed > 0 ? `${crashed} file(s) couldn't be checked and were skipped` : "",
    ]
      .filter(Boolean)
      .join("; ");
    parts.push(
      `<p class="repo-scan-summary">${
        files.length === 0
          ? "No check problems found."
          : `${totalProblems} problem(s) across ${files.length} file(s).`
      }${caveats ? ` (${caveats}.)` : ""}</p>`,
    );
    if (files.length > 0) {
      const items = files
        .map((f) => {
          const fileUrl = `https://github.com/${ref.owner}/${ref.repo}/blob/${outcome.defaultBranch}/${f.path}`;
          return (
            `<li><a class="repo-scan-file-link" href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener"><code>${escapeHtml(f.path)}</code></a>` +
            `<details><summary>${f.problemCount} problem(s)</summary><pre>${escapeHtml(f.findingsText)}</pre></details></li>`
          );
        })
        .join("");
      parts.push(`<ul class="repo-scan-files">${items}</ul>`);
    }
    if (addActionUrl) {
      parts.push(
        `<a class="tryout-btn" target="_blank" rel="noopener" href="${escapeHtml(addActionUrl)}">Add visimark.yml to ${escapeHtml(`${ref.owner}/${ref.repo}`)} on GitHub &rarr;</a>`,
      );
    }
  }

  reportEl.innerHTML = parts.join("\n");
  reportEl.hidden = false;
}

export function wireRepoScan(): void {
  const form = byId<HTMLFormElement>("repo-scan-form");
  const input = byId<HTMLInputElement>("repo-scan-input");
  const submit = byId<HTMLButtonElement>("repo-scan-submit");
  const statusEl = byId("repo-scan-status");
  const reportEl = byId("repo-scan-report");
  if (!form || !input || !submit || !statusEl || !reportEl) return;

  function setStatus(message: string, fraction: number | null, isError = false): void {
    statusEl!.hidden = false;
    statusEl!.classList.toggle("is-error", isError);
    const spinner = isError ? "" : '<span class="repo-scan-spinner" aria-hidden="true"></span>';
    const bar =
      fraction === null
        ? ""
        : `<span class="repo-scan-bar"><span class="repo-scan-bar-fill" style="width:${Math.round(fraction * 100)}%"></span></span>`;
    statusEl!.innerHTML = `${spinner}<span>${escapeHtml(message)}</span>${bar}`;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const ref = parseRepoInput(input.value);
    reportEl.hidden = true;
    reportEl.innerHTML = "";
    if (!ref) {
      setStatus('Enter a repo as "owner/repo" or a github.com URL.', null, true);
      return;
    }

    submit.disabled = true;
    setStatus("Resolving repo…", null);

    void (async () => {
      const [outcome, actionTag] = await withTimeout(
        Promise.all([
          runScan(ref, (message, fraction) => setStatus(message, fraction)),
          latestVisimarkTag(),
        ]),
        90_000,
        "This is taking far longer than it should — try a smaller repo, or try again.",
      );
      const addActionUrl = outcome.hasAction
        ? null
        : githubNewFileUrl(
            ref,
            outcome.defaultBranch,
            workflowYaml(outcome.defaultBranch, actionTag),
          );
      statusEl.hidden = true;
      renderReport(reportEl, ref, outcome, addActionUrl);
    })()
      .catch((err: unknown) => {
        const message =
          err instanceof ScanError ? err.message : "Something went wrong scanning that repo.";
        setStatus(message, null, true);
      })
      .finally(() => {
        submit.disabled = false;
      });
  });
}
