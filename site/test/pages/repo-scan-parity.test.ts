import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as engine from "../../../packages/visimark/src/browser.js";
import { investigate, selectFiles } from "visimark-investigate";
import { gatherInputs, reportHtml } from "../../src/pages/repo-scan.js";

// The widget and the CLI must reach the same Report for the same repository
// at the same commit (spec §4.4). The CLI's inputs are built here the way
// `investigateWorkdir` builds them; the widget's come through its own fetch
// adapter, with GitHub stubbed out of the same files.
const ROOT = join(import.meta.dir, "../../..");
const FIX = join(ROOT, "packages/visimark-investigate/test/fixtures/rules");
const SHA = "3f9c1e2a4b7d000000000000000000000000beef";

const files = new Map<string, string>([
  ["README.md", "# Fixture\n\n<!--vmark:no-formulas-->\n"],
  ["LICENSE", "MIT\n"],
  ["test/fixture.md", readFileSync(join(FIX, "total-row/bad.md"), "utf8")],
  [
    "docs/example-lunch-split-drift.md",
    readFileSync(join(ROOT, "docs/example-lunch-split-drift.md"), "utf8"),
  ],
  ["docs/budget.md", readFileSync(join(FIX, "total-row/bad.md"), "utf8")],
  ["docs/quote.md", readFileSync(join(FIX, "line-product/bad.md"), "utf8")],
]);

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stub(repo: Map<string, string>, opts: { failRaw?: Set<string> } = {}) {
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push(url);
    const json = (v: unknown) => new Response(JSON.stringify(v), { status: 200 });
    if (url === "https://api.github.com/repos/o/r") return json({ default_branch: "main" });
    if (url === "https://api.github.com/repos/o/r/commits/main") {
      return json({ sha: SHA, commit: { committer: { date: "2026-09-30T12:00:00Z" } } });
    }
    if (url === `https://api.github.com/repos/o/r/git/trees/${SHA}?recursive=1`) {
      return json({
        tree: [...repo].map(([path, text]) => ({ path, type: "blob", size: text.length })),
      });
    }
    const raw = `https://raw.githubusercontent.com/o/r/${SHA}/`;
    if (url.startsWith(raw)) {
      const path = decodeURIComponent(url.slice(raw.length));
      if (opts.failRaw?.has(path)) return new Response("", { status: 500 });
      const text = repo.get(path);
      return text === undefined
        ? new Response("", { status: 404 })
        : new Response(text, { status: 200 });
    }
    return new Response("", { status: 404 });
  }) as typeof fetch;
  return calls;
}

const gather = () =>
  gatherInputs(
    { owner: "o", repo: "r" },
    async () => engine,
    () => {},
  );

describe("the widget adapter", () => {
  test("reaches the CLI's Report for the same files", async () => {
    stub(files);
    const { input } = await gather();
    const widget = investigate(input, engine);

    const paths = [...files].map(([path, text]) => ({ path, size: text.length }));
    const { markdown, skipped } = selectFiles(paths);
    const cli = investigate(
      {
        repo: { label: "o/r", host: "github.com", commit: SHA, lastCommit: "2026-09-30" },
        engineVersion: input.engineVersion,
        paths,
        texts: new Map(markdown.map((p) => [p, files.get(p)!])),
        skipped,
        workflowTexts: [],
        clonePath: null,
      },
      engine,
    );
    expect(widget).toEqual(cli);
    expect(widget.accuracy.confirmed).toBe(3);
  });

  test("fetches raw at the commit, not the branch", async () => {
    const calls = stub(files);
    await gather();
    const raw = calls.filter((u) => u.startsWith("https://raw.githubusercontent.com/"));
    expect(raw.length).toBeGreaterThan(0);
    expect(raw.every((u) => u.includes(`/${SHA}/`))).toBe(true);
  });

  test("exactly 3 api.github.com calls", async () => {
    const calls = stub(files);
    await gather();
    expect(calls.filter((u) => u.startsWith("https://api.github.com/")).length).toBe(3);
  });

  test("file-cap 500 records file-cap skips", async () => {
    const many = new Map(files);
    for (let i = 0; i < 501; i++) many.set(`notes/n${String(i).padStart(3, "0")}.md`, "# n\n");
    stub(many);
    const { input } = await gather();
    expect(input.skipped.filter((s) => s.reason === "file-cap").length).toBe(5);
  });

  test("a twice-failed raw fetch records fetch-failed", async () => {
    stub(files, { failRaw: new Set(["docs/quote.md"]) });
    const { input } = await gather();
    expect(input.skipped).toContainEqual({ path: "docs/quote.md", reason: "fetch-failed" });
  });

  test("an action-using repo is still investigated and the add-workflow link is absent", async () => {
    const adopted = new Map(files);
    adopted.set(
      ".github/workflows/visimark.yml",
      "steps:\n  - uses: michal-niedzwiedzki/visimark@v0.4.1\n",
    );
    stub(adopted);
    const { input } = await gather();
    const report = investigate(input, engine);
    expect(report.posture.actionUsed).toBe(true);
    expect(report.findings.length).toBe(3);
    const html = reportHtml(report, "https://example.invalid/add");
    expect(html).not.toContain("Add visimark.yml");
    expect(html).toContain("Wrong number");
  });

  test("an unadopted repo offers the add-workflow link and escapes text", async () => {
    stub(files);
    const report = investigate((await gather()).input, engine);
    report.findings[0]!.message = "<script>x</script>";
    const html = reportHtml(report, "https://example.invalid/add");
    expect(html).toContain("Add visimark.yml");
    expect(html).not.toContain("<script>x");
  });
});
