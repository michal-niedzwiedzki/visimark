import { describe, expect, test } from "bun:test";
import {
  cacheDirName,
  emptyManifest,
  isAlreadyScanned,
  parseManifest,
  serializeManifest,
  upsertEntry,
} from "./repo-pr-manifest.js";

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
      repo: "octocat/hello-world",
      cloneUrl: "https://github.com/octocat/hello-world.git",
      ref: "abc123",
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
      repo: "a/b",
      cloneUrl: "https://github.com/a/b.git",
      ref: "111",
      scannedAt: "2026-09-30T00:00:00.000Z",
      hasFindings: false,
    });
    expect(m.repos["a/b"]?.ref).toBe("111");
  });

  test("replaces the prior entry for the same repo", () => {
    let m = upsertEntry(emptyManifest(), {
      repo: "a/b",
      cloneUrl: "https://github.com/a/b.git",
      ref: "111",
      scannedAt: "2026-09-30T00:00:00.000Z",
      hasFindings: false,
    });
    m = upsertEntry(m, {
      repo: "a/b",
      cloneUrl: "https://github.com/a/b.git",
      ref: "222",
      scannedAt: "2026-09-30T01:00:00.000Z",
      hasFindings: true,
      workdir: "/tmp/a-b-222",
    });
    expect(Object.keys(m.repos)).toEqual(["a/b"]);
    expect(m.repos["a/b"]?.ref).toBe("222");
  });

  test("leaves other repos' entries untouched", () => {
    let m = upsertEntry(emptyManifest(), {
      repo: "a/b",
      cloneUrl: "https://github.com/a/b.git",
      ref: "111",
      scannedAt: "2026-09-30T00:00:00.000Z",
      hasFindings: false,
    });
    m = upsertEntry(m, {
      repo: "c/d",
      cloneUrl: "https://github.com/c/d.git",
      ref: "999",
      scannedAt: "2026-09-30T00:00:00.000Z",
      hasFindings: false,
    });
    expect(m.repos["a/b"]?.ref).toBe("111");
    expect(m.repos["c/d"]?.ref).toBe("999");
  });
});

describe("isAlreadyScanned", () => {
  test("false when the repo has no entry at all", () => {
    expect(isAlreadyScanned(emptyManifest(), "a/b", "111")).toBe(false);
  });

  test("false when the entry is for a different ref (repo moved on)", () => {
    const m = upsertEntry(emptyManifest(), {
      repo: "a/b",
      cloneUrl: "https://github.com/a/b.git",
      ref: "111",
      scannedAt: "2026-09-30T00:00:00.000Z",
      hasFindings: false,
    });
    expect(isAlreadyScanned(m, "a/b", "222")).toBe(false);
  });

  test("true when the entry matches repo and ref exactly", () => {
    const m = upsertEntry(emptyManifest(), {
      repo: "a/b",
      cloneUrl: "https://github.com/a/b.git",
      ref: "111",
      scannedAt: "2026-09-30T00:00:00.000Z",
      hasFindings: false,
    });
    expect(isAlreadyScanned(m, "a/b", "111")).toBe(true);
  });
});

describe("cacheDirName", () => {
  test("joins owner and repo with the shortened ref", () => {
    expect(cacheDirName("octocat/hello-world", "a1b2c3d4e5f6789")).toBe(
      "octocat-hello-world-a1b2c3d4e5f6",
    );
  });

  test("uses the whole ref when it's shorter than the short length", () => {
    expect(cacheDirName("a/b", "abc")).toBe("a-b-abc");
  });
});
