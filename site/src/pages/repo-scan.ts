/**
 * "Scan your repo" widget on the homepage: paste a public `owner/repo`, fetch
 * its tracked files straight from GitHub (no clone, no server —
 * `raw.githubusercontent.com` and `api.github.com` both send permissive CORS
 * headers), and run the investigation core (`packages/visimark-investigate`)
 * over them in the browser — the same code `bun run repo:investigate` runs,
 * so both report the same findings for the same repo and commit. This file
 * only fetches and renders; it judges nothing itself. Spec:
 * docs/design/one-investigation-core-behind-repo-spec.md.
 *
 * Three API calls per scan — the repo (its default branch), that branch's
 * commit (the scan is pinned to it, so permalinks hold and files are read at
 * one commit), and the commit's tree. Everything else is raw content.
 *
 * The engine (`vendor/visimark-browser.js`, ~300KB minified) is not fetched
 * until the form is submitted, via a dynamically injected `<script>` tag —
 * it's an IIFE bundle, not a module, so `import()` can't load it (see
 * `../playground/browser-entry.ts`'s header comment for why the playground
 * bundle is built that way; this page's copy is the same build). Every
 * visit that doesn't use the widget pays nothing for it. The core reaches it
 * as an argument, never as an import.
 */
import enginePackage from "../../../packages/visimark/package.json" with { type: "json" };
import {
  encodePath,
  findingLines,
  importTargets,
  investigate,
  looksGenerated,
  selectFiles,
  summaryLines,
  type Engine,
  type InvestigateInput,
  type Report,
  type Skipped,
} from "visimark-investigate";
import type { VisiMarkApi } from "../playground/types.js";
import { byId } from "./dom.js";
import { escapeHtml, setTrustedHtml } from "../html.js";

const API = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";
const ENGINE_SRC = "vendor/visimark-browser.js";
/** Last known-good release, used only if the live lookup below fails. */
const FALLBACK_TAG = "v0.1.10";
/** The widget's file cap (spec §3.4): past it, the first files in byte order
 *  are read and the rest are reported as `file-cap` skips. Set well above
 *  what a normal docs-heavy repo carries — this project's own repo has a
 *  couple of hundred after dot-paths are excluded. It protects a browser tab,
 *  not a policy about what counts as a document, so the CLI has none. */
const MAX_FILES = 500;
const CONCURRENCY = 6;
/** One retry, after a short pause, for a raw-content fetch that failed —
 *  covers a transient network blip or a momentary throttle on one request
 *  out of a few hundred, which used to take down the whole scan (a single
 *  rejected `fetch()` propagated uncaught through the pool). */
const RETRY_DELAY_MS = 400;

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
  size?: number;
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

/**
 * Everything the core needs, fetched from GitHub (spec §2.4, §3.2): the
 * commit, every tracked path with its size, the Markdown the policy keeps,
 * the workflows and the import targets. The engine is loaded only once the
 * Markdown is in hand, and handed back so the caller investigates with it.
 */
export async function gatherInputs(
  ref: RepoRef,
  loadEngine: () => Promise<Engine>,
  onProgress: (message: string, fraction: number | null) => void,
): Promise<{ input: InvestigateInput; defaultBranch: string; engine: Engine }> {
  onProgress(`Resolving ${ref.owner}/${ref.repo}…`, null);
  const base = `${API}/repos/${ref.owner}/${ref.repo}`;
  const repoInfo = (await fetchJson(base)) as { default_branch: string };
  const defaultBranch = repoInfo.default_branch;
  const commit = (await fetchJson(`${base}/commits/${encodeURIComponent(defaultBranch)}`)) as {
    sha: string;
    commit?: { committer?: { date?: string } };
  };
  const sha = commit.sha;
  const tree = (await fetchJson(`${base}/git/trees/${sha}?recursive=1`)) as {
    tree: GitTreeEntry[];
  };
  const raw = (path: string) =>
    fetchRawText(`${RAW}/${ref.owner}/${ref.repo}/${sha}/${encodePath(path)}`);

  const paths = tree.tree
    .filter((e) => e.type === "blob")
    .map((e) => ({ path: e.path, size: e.size ?? 0 }));
  const tracked = new Set(paths.map((p) => p.path));

  const workflowPaths = paths
    .map((p) => p.path)
    .filter((p) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(p));
  const workflowFetched = await mapPool(workflowPaths, CONCURRENCY, raw);
  const workflowTexts = workflowFetched.some((t) => t === null)
    ? null
    : (workflowFetched as string[]);

  const { markdown, skipped: policySkipped } = selectFiles(paths, MAX_FILES);
  const skipped: Skipped[] = [...policySkipped];
  const texts = new Map<string, string>();
  onProgress(`Fetching ${markdown.length} file(s)…`, 0);
  let fetched = 0;
  const fetchedTexts = await mapPool(markdown, CONCURRENCY, async (path) => {
    const text = await raw(path);
    fetched++;
    onProgress(
      `Fetching ${markdown.length} file(s)… (${fetched}/${markdown.length})`,
      fetched / markdown.length,
    );
    return text;
  });
  markdown.forEach((path, i) => {
    const text = fetchedTexts[i];
    if (text === null || text === undefined) skipped.push({ path, reason: "fetch-failed" });
    else if (looksGenerated(text)) skipped.push({ path, reason: "generated" });
    else texts.set(path, text);
  });

  onProgress("Loading engine…", null);
  const engine = await loadEngine();
  const targets = importTargets(texts, engine).filter((t) => tracked.has(t) && !texts.has(t));
  const targetTexts = await mapPool(targets, CONCURRENCY, raw);
  targets.forEach((t, i) => {
    const text = targetTexts[i];
    if (text !== null && text !== undefined) texts.set(t, text);
  });

  const date = commit.commit?.committer?.date;
  return {
    defaultBranch,
    engine,
    input: {
      repo: {
        label: `${ref.owner}/${ref.repo}`,
        host: "github.com",
        commit: sha,
        lastCommit: date ? date.slice(0, 10) : null,
      },
      engineVersion: enginePackage.version,
      paths,
      texts,
      skipped,
      workflowTexts,
      clonePath: null,
    },
  };
}

async function runScan(
  ref: RepoRef,
  onProgress: (message: string, fraction: number | null) => void,
): Promise<{ report: Report; defaultBranch: string }> {
  const { input, defaultBranch, engine } = await gatherInputs(ref, loadEngine, onProgress);
  onProgress("Checking…", null);
  await delay(0);
  return { report: investigate(input, engine), defaultBranch };
}

/**
 * The report as HTML: the core's own summary and finding lines, escaped —
 * the CLI prints the very same lines (spec §4.5). The "Add visimark.yml"
 * link appears only for a repo that does not already run the Action.
 */
export function reportHtml(report: Report, addActionUrl: string | null): string {
  const parts: string[] = [];
  const lines = summaryLines(report).map((l) => escapeHtml(l));
  parts.push(`<p class="repo-scan-summary">${lines.join("<br>")}</p>`);

  const count = (reason: Skipped["reason"]) =>
    report.files.skipped.filter((s) => s.reason === reason).length;
  const caveats = [
    count("file-cap") > 0
      ? `stopped after ${MAX_FILES} files; ${count("file-cap")} more weren't scanned`
      : "",
    count("fetch-failed") > 0
      ? `${count("fetch-failed")} file(s) couldn't be fetched and were skipped — try again?`
      : "",
    report.ruleErrors.length > 0
      ? `${report.ruleErrors.length} check(s) couldn't run on a file and were skipped`
      : "",
  ].filter(Boolean);
  if (caveats.length > 0) {
    parts.push(`<p class="repo-scan-summary">(${escapeHtml(caveats.join("; "))}.)</p>`);
  }

  if (report.findings.length === 0) {
    parts.push(`<p class="repo-scan-summary">No wrong numbers found.</p>`);
  } else {
    const items = report.findings
      .map((f) => {
        const [headline = "", message = "", foundBy = ""] = findingLines(f, "web");
        const title = f.permalink
          ? `<a class="repo-scan-file-link" href="${escapeHtml(f.permalink)}" target="_blank" rel="noopener">${escapeHtml(headline)}</a>`
          : escapeHtml(headline);
        const evidence =
          f.evidence.length > 0
            ? `<details><summary>source</summary><pre>${escapeHtml(f.evidence.join("\n"))}</pre></details>`
            : "";
        return `<li><strong>${title}</strong><br>${escapeHtml(message)}<br><small>${escapeHtml(foundBy)}</small>${evidence}</li>`;
      })
      .join("");
    parts.push(`<ul class="repo-scan-files">${items}</ul>`);
  }

  if (addActionUrl && report.posture.actionUsed === false) {
    parts.push(
      `<a class="tryout-btn" target="_blank" rel="noopener" href="${escapeHtml(addActionUrl)}">Add visimark.yml to ${escapeHtml(report.repo.label)} on GitHub &rarr;</a>`,
    );
  }
  return parts.join("\n");
}

function renderReport(reportEl: HTMLElement, report: Report, addActionUrl: string | null): void {
  setTrustedHtml(reportEl, reportHtml(report, addActionUrl));
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
    const parts: Node[] = [];
    if (!isError) {
      const spinner = document.createElement("span");
      spinner.className = "repo-scan-spinner";
      spinner.setAttribute("aria-hidden", "true");
      parts.push(spinner);
    }
    const text = document.createElement("span");
    text.textContent = message;
    parts.push(text);
    if (fraction !== null) {
      const bar = document.createElement("span");
      bar.className = "repo-scan-bar";
      const fill = document.createElement("span");
      fill.className = "repo-scan-bar-fill";
      fill.style.width = `${Math.round(fraction * 100)}%`;
      bar.appendChild(fill);
      parts.push(bar);
    }
    statusEl!.replaceChildren(...parts);
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
      const [{ report, defaultBranch }, actionTag] = await withTimeout(
        Promise.all([
          runScan(ref, (message, fraction) => setStatus(message, fraction)),
          latestVisimarkTag(),
        ]),
        90_000,
        "This is taking far longer than it should — try a smaller repo, or try again.",
      );
      const addActionUrl = githubNewFileUrl(
        ref,
        defaultBranch,
        workflowYaml(defaultBranch, actionTag),
      );
      statusEl.hidden = true;
      renderReport(reportEl, report, addActionUrl);
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
