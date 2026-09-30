import { describe, expect, test } from "bun:test";
import {
  cacheDirName,
  emptyManifest,
  isAlreadyScanned,
  manifestKey,
  parseManifest,
  serializeManifest,
  upsertEntry,
} from "./repo-pr-manifest.js";

const GH = "github.com";

describe("parseManifest", () => {
  test("returns an empty manifest for undefined (file didn't exist)", () => {
    expect(parseManifest(undefined)).toEqual(emptyManifest());
  });

  test("returns an empty manifest for a blank file", () => {
    expect(parseManifest("   \n")).toEqual(emptyManifest());
  });

  test("returns an empty manifest for corrupt JSON rather than throwing", () => {
    expect(parseManifest("{not json")).toEqual(emptyManifest());
  });

  test("round-trips through serializeManifest", () => {
    const m = upsertEntry(emptyManifest(), {
      host: GH,
      repo: "octocat/hello-world",
      cloneUrl: "https://github.com/octocat/hello-world.git",
      ref: "abc123",
      defaultBranch: "main",
      scannedAt: "2026-09-30T00:00:00.000Z",
      hasFindings: true,
      workdir: "/tmp/octocat-hello-world-abc123",
    });
    expect(parseManifest(serializeManifest(m))).toEqual(m);
  });
});

describe("upsertEntry", () => {
  test("adds a new entry", () => {
    const m = upsertEntry(emptyManifest(), {
      host: GH,
      repo: "a/b",
      cloneUrl: "https://github.com/a/b.git",
      ref: "111",
      defaultBranch: "main",
      scannedAt: "2026-09-30T00:00:00.000Z",
      hasFindings: false,
    });
    expect(m.repos[manifestKey(GH, "a/b")]?.ref).toBe("111");
  });

  test("replaces the prior entry for the same host+repo", () => {
    let m = upsertEntry(emptyManifest(), {
      host: GH,
      repo: "a/b",
      cloneUrl: "https://github.com/a/b.git",
      ref: "111",
      defaultBranch: "main",
      scannedAt: "2026-09-30T00:00:00.000Z",
      hasFindings: false,
    });
    m = upsertEntry(m, {
      host: GH,
      repo: "a/b",
      cloneUrl: "https://github.com/a/b.git",
      ref: "222",
      defaultBranch: "main",
      scannedAt: "2026-09-30T01:00:00.000Z",
      hasFindings: true,
      workdir: "/tmp/a-b-222",
    });
    expect(Object.keys(m.repos)).toEqual([manifestKey(GH, "a/b")]);
    expect(m.repos[manifestKey(GH, "a/b")]?.ref).toBe("222");
  });

  test("leaves other repos' entries untouched", () => {
    let m = upsertEntry(emptyManifest(), {
      host: GH,
      repo: "a/b",
      cloneUrl: "https://github.com/a/b.git",
      ref: "111",
      defaultBranch: "main",
      scannedAt: "2026-09-30T00:00:00.000Z",
      hasFindings: false,
    });
    m = upsertEntry(m, {
      host: GH,
      repo: "c/d",
      cloneUrl: "https://github.com/c/d.git",
      ref: "999",
      defaultBranch: "main",
      scannedAt: "2026-09-30T00:00:00.000Z",
      hasFindings: false,
    });
    expect(m.repos[manifestKey(GH, "a/b")]?.ref).toBe("111");
    expect(m.repos[manifestKey(GH, "c/d")]?.ref).toBe("999");
  });

  test("does not collide the same owner/repo on two different hosts", () => {
    let m = upsertEntry(emptyManifest(), {
      host: "github.com",
      repo: "a/b",
      cloneUrl: "https://github.com/a/b.git",
      ref: "111",
      defaultBranch: "main",
      scannedAt: "2026-09-30T00:00:00.000Z",
      hasFindings: false,
    });
    m = upsertEntry(m, {
      host: "gitlab.com",
      repo: "a/b",
      cloneUrl: "https://gitlab.com/a/b.git",
      ref: "999",
      defaultBranch: "main",
      scannedAt: "2026-09-30T00:00:00.000Z",
      hasFindings: false,
    });
    expect(Object.keys(m.repos)).toHaveLength(2);
    expect(m.repos[manifestKey("github.com", "a/b")]?.ref).toBe("111");
    expect(m.repos[manifestKey("gitlab.com", "a/b")]?.ref).toBe("999");
  });
});

describe("isAlreadyScanned", () => {
  test("false when the repo has no entry at all", () => {
    expect(isAlreadyScanned(emptyManifest(), GH, "a/b", "111")).toBe(false);
  });

  test("false when the entry is for a different ref (repo moved on)", () => {
    const m = upsertEntry(emptyManifest(), {
      host: GH,
      repo: "a/b",
      cloneUrl: "https://github.com/a/b.git",
      ref: "111",
      defaultBranch: "main",
      scannedAt: "2026-09-30T00:00:00.000Z",
      hasFindings: false,
    });
    expect(isAlreadyScanned(m, GH, "a/b", "222")).toBe(false);
  });

  test("false when the entry is for the same repo on a different host", () => {
    const m = upsertEntry(emptyManifest(), {
      host: "gitlab.com",
      repo: "a/b",
      cloneUrl: "https://gitlab.com/a/b.git",
      ref: "111",
      defaultBranch: "main",
      scannedAt: "2026-09-30T00:00:00.000Z",
      hasFindings: false,
    });
    expect(isAlreadyScanned(m, GH, "a/b", "111")).toBe(false);
  });

  test("true when the entry matches host, repo, and ref exactly", () => {
    const m = upsertEntry(emptyManifest(), {
      host: GH,
      repo: "a/b",
      cloneUrl: "https://github.com/a/b.git",
      ref: "111",
      defaultBranch: "main",
      scannedAt: "2026-09-30T00:00:00.000Z",
      hasFindings: false,
    });
    expect(isAlreadyScanned(m, GH, "a/b", "111")).toBe(true);
  });
});

describe("cacheDirName", () => {
  test("nests the repo name under the host and owner, with the shortened ref", () => {
    expect(cacheDirName(GH, "octocat/hello-world", "a1b2c3d4e5f6789")).toBe(
      "github.com/octocat/hello-world-a1b2c3d4e5f6",
    );
  });

  test("uses the whole ref when it's shorter than the short length", () => {
    expect(cacheDirName(GH, "a/b", "abc")).toBe("github.com/a/b-abc");
  });

  test("does not collide a-b/c with a/b-c", () => {
    expect(cacheDirName(GH, "a-b/c", "abc")).not.toBe(cacheDirName(GH, "a/b-c", "abc"));
  });

  test("does not collide the same owner/repo on two different hosts", () => {
    expect(cacheDirName("github.com", "a/b", "abc")).not.toBe(
      cacheDirName("gitlab.com", "a/b", "abc"),
    );
  });
});
