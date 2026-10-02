import { afterEach, describe, expect, test } from "bun:test";
import {
  encodePath,
  fetchRawText,
  githubNewFileUrl,
  isDotPath,
  mapPool,
  parseRepoInput,
  VISIMARK_ACTION_USE,
  workflowYaml,
} from "./repo-scan.js";

describe("encodePath", () => {
  test("leaves an ordinary path untouched", () => {
    expect(encodePath("docs/readme.md")).toBe("docs/readme.md");
  });

  test("encodes a hash in a filename without eating the rest of the path", () => {
    expect(encodePath("docs/C#-notes.md")).toBe("docs/C%23-notes.md");
  });

  test("encodes a question mark and percent sign", () => {
    expect(encodePath("notes?.md")).toBe("notes%3F.md");
    expect(encodePath("100%.md")).toBe("100%25.md");
  });

  test("preserves the slash between segments", () => {
    expect(encodePath("a/b/c.md").split("/")).toHaveLength(3);
  });
});

describe("fetchRawText", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("returns the body on a successful fetch", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(new Response("hello"))) as unknown as typeof globalThis.fetch;
    expect(await fetchRawText("https://example.test/x")).toBe("hello");
  });

  test("retries once after a rejected fetch and succeeds", async () => {
    let calls = 0;
    globalThis.fetch = (() => {
      calls++;
      if (calls === 1) return Promise.reject(new TypeError("network error"));
      return Promise.resolve(new Response("recovered"));
    }) as unknown as typeof globalThis.fetch;
    expect(await fetchRawText("https://example.test/x")).toBe("recovered");
    expect(calls).toBe(2);
  });

  test("retries once after a non-ok response and succeeds", async () => {
    let calls = 0;
    globalThis.fetch = (() => {
      calls++;
      if (calls === 1) return Promise.resolve(new Response("", { status: 429 }));
      return Promise.resolve(new Response("recovered"));
    }) as unknown as typeof globalThis.fetch;
    expect(await fetchRawText("https://example.test/x")).toBe("recovered");
  });

  test("returns null — not empty string — when both attempts fail", async () => {
    globalThis.fetch = (() =>
      Promise.reject(new TypeError("network error"))) as unknown as typeof globalThis.fetch;
    expect(await fetchRawText("https://example.test/x")).toBeNull();
  });
});

describe("parseRepoInput", () => {
  test("accepts owner/repo shorthand", () => {
    expect(parseRepoInput("octocat/hello-world")).toEqual({
      owner: "octocat",
      repo: "hello-world",
    });
  });

  test("accepts a github.com URL", () => {
    expect(parseRepoInput("https://github.com/octocat/hello-world")).toEqual({
      owner: "octocat",
      repo: "hello-world",
    });
  });

  test("accepts a github.com URL with a trailing slash and no scheme", () => {
    expect(parseRepoInput("github.com/octocat/hello-world/")).toEqual({
      owner: "octocat",
      repo: "hello-world",
    });
  });

  test("accepts a github.com URL with a .git suffix", () => {
    expect(parseRepoInput("https://github.com/octocat/hello-world.git")).toEqual({
      owner: "octocat",
      repo: "hello-world",
    });
  });

  test("accepts a github.com URL with extra path segments", () => {
    expect(parseRepoInput("https://github.com/octocat/hello-world/tree/main/docs")).toEqual({
      owner: "octocat",
      repo: "hello-world",
    });
  });

  test("trims surrounding whitespace", () => {
    expect(parseRepoInput("  octocat/hello-world  ")).toEqual({
      owner: "octocat",
      repo: "hello-world",
    });
  });

  test("rejects garbage input", () => {
    expect(parseRepoInput("not a repo")).toBeNull();
  });

  test("rejects an empty string", () => {
    expect(parseRepoInput("")).toBeNull();
  });

  test("rejects a URL from a different host", () => {
    expect(parseRepoInput("https://gitlab.com/octocat/hello-world")).toBeNull();
  });
});

describe("mapPool", () => {
  test("preserves result order regardless of completion order", async () => {
    const items = [30, 10, 20];
    const results = await mapPool(
      items,
      3,
      (ms) => new Promise((r) => setTimeout(() => r(ms), ms)),
    );
    expect(results).toEqual([30, 10, 20]);
  });

  test("never runs more than `limit` at once", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);
    await mapPool(items, 3, async (i) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return i;
    });
    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  test("handles an empty list", async () => {
    const results = await mapPool([] as number[], 3, async (i) => i);
    expect(results).toEqual([]);
  });

  test("handles a limit larger than the list", async () => {
    const results = await mapPool([1, 2], 10, async (i) => i * 2);
    expect(results).toEqual([2, 4]);
  });
});

describe("workflowYaml", () => {
  test("pins the default branch and the action tag", () => {
    const yaml = workflowYaml("main", "v0.1.10");
    expect(yaml).toContain("branches: [main]");
    expect(yaml).toContain("uses: michal-niedzwiedzki/visimark@v0.1.10");
    expect(yaml).toContain("permissions:\n  contents: read");
  });
});

describe("isDotPath", () => {
  test("flags a file directly under a dot-directory", () => {
    expect(isDotPath(".github/workflows/ci.yml")).toBe(true);
  });

  test("flags a dot-directory buried deeper in the path", () => {
    expect(isDotPath("docs/.internal/notes.md")).toBe(true);
  });

  test("flags a bare dot-file", () => {
    expect(isDotPath(".env.md")).toBe(true);
  });

  test("does not flag an ordinary path", () => {
    expect(isDotPath("docs/readme.md")).toBe(false);
  });

  test("does not flag a segment that merely contains a dot", () => {
    expect(isDotPath("docs/v1.2/notes.md")).toBe(false);
  });
});

describe("VISIMARK_ACTION_USE", () => {
  test("matches a pinned action reference", () => {
    const yaml = "steps:\n  - uses: michal-niedzwiedzki/visimark@v0.1.10\n";
    expect(VISIMARK_ACTION_USE.test(yaml)).toBe(true);
  });

  test("matches an action.yml path reference", () => {
    const yaml = "steps:\n  - uses: michal-niedzwiedzki/visimark/action.yml@v0.1.10\n";
    expect(VISIMARK_ACTION_USE.test(yaml)).toBe(true);
  });

  test("does not match an unrelated action", () => {
    const yaml = "steps:\n  - uses: actions/checkout@v7\n";
    expect(VISIMARK_ACTION_USE.test(yaml)).toBe(false);
  });
});

describe("githubNewFileUrl", () => {
  test("builds a github.com/new link carrying the workflow content", () => {
    const url = githubNewFileUrl(
      { owner: "octocat", repo: "hello-world" },
      "main",
      "name: visimark\n",
    );
    expect(url.startsWith("https://github.com/octocat/hello-world/new/main?")).toBe(true);
    const params = new URL(url).searchParams;
    expect(params.get("filename")).toBe(".github/workflows/visimark.yml");
    expect(params.get("value")).toBe("name: visimark\n");
    expect(params.get("message")).toBe("Add VisiMark check");
  });
});
