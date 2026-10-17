import { describe, expect, test } from "bun:test";
import {
  blobUrl,
  encodePath,
  hasVisimarkAction,
  hostOf,
  isDotPath,
  parseRepoArg,
} from "../src/repo.js";

describe("hostOf", () => {
  test("defaults the owner/repo shorthand to github.com", () => {
    expect(hostOf("https://github.com/octocat/hello-world.git")).toBe("github.com");
  });

  test("reads an explicit https host", () => {
    expect(hostOf("https://gitlab.com/octocat/hello-world.git")).toBe("gitlab.com");
  });

  test("reads an explicit ssh host", () => {
    expect(hostOf("git@gitlab.com:octocat/hello-world.git")).toBe("gitlab.com");
  });

  test("distinguishes two hosts mirroring the same owner/repo", () => {
    expect(hostOf("https://github.com/octocat/hello-world.git")).not.toBe(
      hostOf("https://gitlab.com/octocat/hello-world.git"),
    );
  });
});

describe("parseRepoArg", () => {
  test("resolves owner/repo shorthand to a GitHub clone URL", () => {
    const r = parseRepoArg("octocat/hello-world");
    expect(r).toEqual({
      cloneUrl: "https://github.com/octocat/hello-world.git",
      label: "octocat/hello-world",
    });
  });

  test("accepts an https URL as-is and derives the label", () => {
    const r = parseRepoArg("https://github.com/octocat/hello-world.git");
    expect(r).toEqual({
      cloneUrl: "https://github.com/octocat/hello-world.git",
      label: "octocat/hello-world",
    });
  });

  test("accepts an ssh URL and derives the label", () => {
    const r = parseRepoArg("git@github.com:octocat/hello-world.git");
    expect(r).toEqual({
      cloneUrl: "git@github.com:octocat/hello-world.git",
      label: "octocat/hello-world",
    });
  });

  test("rejects garbage input", () => {
    const r = parseRepoArg("not a repo");
    expect("error" in r).toBe(true);
  });

  test("rejects an empty string", () => {
    const r = parseRepoArg("   ");
    expect("error" in r).toBe(true);
  });
});

describe("hasVisimarkAction", () => {
  test("detects a pinned action reference", () => {
    const yaml = "steps:\n  - uses: michal-niedzwiedzki/visimark@v0.1.10\n";
    expect(hasVisimarkAction([yaml])).toBe(true);
  });

  test("detects an action.yml path reference", () => {
    const yaml = "steps:\n  - uses: michal-niedzwiedzki/visimark/action.yml@v0.1.10\n";
    expect(hasVisimarkAction([yaml])).toBe(true);
  });

  test("is case-insensitive", () => {
    const yaml = "steps:\n  - Uses: Owner/VisiMark@v1\n";
    expect(hasVisimarkAction([yaml])).toBe(true);
  });

  test("does not match an unrelated action or a bare mention", () => {
    const yaml = "steps:\n  - uses: actions/checkout@v4\n  - run: echo visimark\n";
    expect(hasVisimarkAction([yaml])).toBe(false);
  });

  test("false on no workflows", () => {
    expect(hasVisimarkAction([])).toBe(false);
  });
});

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

describe("blobUrl", () => {
  test("links a line range at the commit on github.com", () => {
    expect(blobUrl("github.com", "o/r", "abc", "docs/a b.md", 3, 15)).toBe(
      "https://github.com/o/r/blob/abc/docs/a%20b.md#L3-L15",
    );
  });

  test("a single line has no range", () => {
    expect(blobUrl("github.com", "o/r", "abc", "a.md", 7)).toBe(
      "https://github.com/o/r/blob/abc/a.md#L7",
    );
  });

  test("null for another host or no host", () => {
    expect(blobUrl("gitlab.com", "o/r", "abc", "a.md", 1)).toBeNull();
    expect(blobUrl(null, "o/r", "abc", "a.md", 1)).toBeNull();
  });
});

describe("VISIMARK_ACTION_USE on hostile input", () => {
  test("a long run of spaces does not backtrack polynomially", () => {
    const hostile = `${" \n".repeat(30_000)}x`;
    const start = performance.now();
    expect(hasVisimarkAction([hostile])).toBe(false);
    expect(performance.now() - start).toBeLessThan(200);
  });

  test("still matches a dash-led step and a bare uses line", () => {
    expect(hasVisimarkAction(["  -   uses: owner/visimark@v1\n"])).toBe(true);
    expect(hasVisimarkAction(["    uses: owner/visimark@v1\n"])).toBe(true);
  });
});
