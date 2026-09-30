import { describe, expect, test } from "bun:test";
import {
  excludeDotPaths,
  extractDisagreements,
  formatDisagreements,
  formatExplain,
  formatFiles,
  formatSummary,
  hasUsefulFindings,
  hasVisimarkAction,
  hostOf,
  parseRepoArg,
  relativizePaths,
  type Palette,
  type ScanReport,
} from "./repo-scan-lib.js";

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

describe("excludeDotPaths", () => {
  test("drops a file directly under a dot-directory", () => {
    expect(excludeDotPaths([".github/ISSUE_TEMPLATE/bug.md"])).toEqual([]);
  });

  test("drops a file under a nested dot-directory", () => {
    expect(excludeDotPaths([".agents/skills/foo/SKILL.md"])).toEqual([]);
  });

  test("drops a dot-directory buried deeper in the path, not just at the root", () => {
    expect(excludeDotPaths(["docs/.internal/notes.md"])).toEqual([]);
  });

  test("drops a bare dot-file", () => {
    expect(excludeDotPaths([".env.md"])).toEqual([]);
  });

  test("keeps an ordinary path", () => {
    expect(excludeDotPaths(["docs/readme.md"])).toEqual(["docs/readme.md"]);
  });

  test("keeps a path whose segment merely contains a dot, not starts with one", () => {
    expect(excludeDotPaths(["docs/v1.2/notes.md"])).toEqual(["docs/v1.2/notes.md"]);
  });

  test("filters a mixed list, preserving order", () => {
    expect(
      excludeDotPaths(["README.md", ".github/foo.md", "docs/a.md", ".changeset/x.md"]),
    ).toEqual(["README.md", "docs/a.md"]);
  });

  test("handles an empty list", () => {
    expect(excludeDotPaths([])).toEqual([]);
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

describe("formatSummary", () => {
  test("reports the skip reason and nothing else when skipped", () => {
    const report: ScanReport = {
      command: "repo-scan",
      repo: "octocat/hello-world",
      cloneUrl: "https://github.com/octocat/hello-world.git",
      ref: "abc123",
      skipped: true,
      skipReason: "repo already runs the visimark action (pass --force to scan anyway)",
      markdownFiles: 0,
    };
    const lines = formatSummary(report);
    expect(lines).toContain(
      "  skipped: repo already runs the visimark action (pass --force to scan anyway)",
    );
    expect(lines.some((l) => l.includes("markdown files"))).toBe(false);
  });

  test("reports file count and check/infer summaries when scanned", () => {
    const report: ScanReport = {
      command: "repo-scan",
      repo: "octocat/hello-world",
      cloneUrl: "https://github.com/octocat/hello-world.git",
      ref: "abc123",
      skipped: false,
      markdownFiles: 3,
      check: { summary: { files: 3, problems: 1, stale: 2, errors: 0 }, files: [] },
      infer: { summary: { files: 3, rules: 4, scalars: 1, anchors: 0 }, files: [] },
    };
    const lines = formatSummary(report).join("\n");
    expect(lines).toContain("markdown files: 3");
    expect(lines).toContain("check: 1 problem(s), 2 stale, 0 error(s) across 3 file(s)");
    expect(lines).toContain("infer: 4 rule(s), 1 scalar(s), 0 anchor(s) across 3 file(s)");
  });
});

describe("relativizePaths", () => {
  test("strips the workdir prefix from file paths and finding locations", () => {
    const section = {
      summary: { files: 1, problems: 1, stale: 0, errors: 1 },
      files: [
        {
          path: "/tmp/visimark-repo-scan-xyz/docs/AGENTS.md",
          findings: [
            {
              code: "COVERAGE",
              location: { file: "/tmp/visimark-repo-scan-xyz/docs/AGENTS.md" },
            },
          ],
        },
      ],
    };
    relativizePaths(section, "/tmp/visimark-repo-scan-xyz");
    expect(section.files[0]!.path).toBe("docs/AGENTS.md");
    expect(section.files[0]!.findings[0]!.location.file).toBe("docs/AGENTS.md");
  });

  test("is a no-op on undefined", () => {
    expect(() => relativizePaths(undefined, "/tmp/x")).not.toThrow();
  });

  test("leaves paths outside the workdir alone", () => {
    const section = { summary: { files: 1 }, files: [{ path: "/elsewhere/AGENTS.md" }] };
    relativizePaths(section, "/tmp/visimark-repo-scan-xyz");
    expect(section.files[0]!.path).toBe("/elsewhere/AGENTS.md");
  });
});

describe("formatFiles", () => {
  const base = {
    command: "repo-scan" as const,
    repo: "octocat/hello-world",
    cloneUrl: "https://github.com/octocat/hello-world.git",
    ref: "abc123",
    markdownFiles: 2,
  };

  test("lists only files with findings or proposals, sorted", () => {
    const report: ScanReport = {
      ...base,
      skipped: false,
      check: {
        summary: { files: 2, problems: 1, stale: 0, errors: 1 },
        files: [
          { path: "z.md", findings: [{ code: "COVERAGE" }] },
          { path: "clean.md", findings: [] },
        ],
      },
      infer: {
        summary: { files: 2, rules: 1, scalars: 0, anchors: 0 },
        files: [
          { path: "a.md", proposals: [{ kind: "column", sheet: "s", name: "n", rule: "r" }] },
          { path: "clean.md", proposals: [] },
        ],
      },
    };
    const lines = formatFiles(report);
    expect(lines).toEqual(["  files:", "    a.md: 1 proposal(s)", "    z.md: 1 finding(s)"]);
  });

  test("empty when skipped", () => {
    const report: ScanReport = { ...base, skipped: true, skipReason: "x" };
    expect(formatFiles(report)).toEqual([]);
  });

  test("empty when nothing found", () => {
    const report: ScanReport = {
      ...base,
      skipped: false,
      check: {
        summary: { files: 1, problems: 0, stale: 0, errors: 0 },
        files: [{ path: "a.md", findings: [] }],
      },
    };
    expect(formatFiles(report)).toEqual([]);
  });
});

describe("hasUsefulFindings", () => {
  const base: ScanReport = {
    command: "repo-scan",
    repo: "o/r",
    cloneUrl: "https://github.com/o/r.git",
    ref: "abc123",
    skipped: false,
    markdownFiles: 1,
  };

  test("false when skipped, even if check/infer are absent", () => {
    expect(hasUsefulFindings({ ...base, skipped: true, skipReason: "x" })).toBe(false);
  });

  test("false when no file has a finding or proposal", () => {
    const report: ScanReport = {
      ...base,
      skipped: false,
      check: {
        summary: { files: 1, problems: 0, stale: 0, errors: 0 },
        files: [{ path: "a.md", findings: [] }],
      },
    };
    expect(hasUsefulFindings(report)).toBe(false);
  });

  test("true when a file has a check finding", () => {
    const report: ScanReport = {
      ...base,
      skipped: false,
      check: {
        summary: { files: 1, problems: 1, stale: 0, errors: 0 },
        files: [{ path: "a.md", findings: [{ code: "COVERAGE" }] }],
      },
    };
    expect(hasUsefulFindings(report)).toBe(true);
  });

  test("true when a file has an infer proposal", () => {
    const report: ScanReport = {
      ...base,
      skipped: false,
      infer: {
        summary: { files: 1, rules: 1, scalars: 0, anchors: 0 },
        files: [
          { path: "a.md", proposals: [{ kind: "column", sheet: "s", name: "n", rule: "r" }] },
        ],
      },
    };
    expect(hasUsefulFindings(report)).toBe(true);
  });
});

describe("extractDisagreements", () => {
  test("pulls near-miss proposals out, ignoring other kinds", () => {
    const section = {
      summary: { files: 1, rules: 1, scalars: 0, anchors: 0 },
      files: [
        {
          path: "docs/deal.md",
          proposals: [
            { kind: "column", sheet: "lines", name: "net", rule: "net = qty * rate" },
            {
              kind: "near-miss",
              sheet: "runs",
              name: "premium_hours",
              rule: "premium_hours = on_call_hours - base_hours",
              disagreement: { rowLabel: "C.2", stored: "12", computed: "15" },
            },
          ],
        },
      ],
    };
    expect(extractDisagreements(section)).toEqual([
      {
        path: "docs/deal.md",
        sheet: "runs",
        name: "premium_hours",
        rule: "premium_hours = on_call_hours - base_hours",
        rowLabel: "C.2",
        stored: "12",
        computed: "15",
      },
    ]);
  });

  test("empty on undefined or no near-misses", () => {
    expect(extractDisagreements(undefined)).toEqual([]);
    expect(
      extractDisagreements({
        summary: { files: 1 },
        files: [
          { path: "a.md", proposals: [{ kind: "column", sheet: "s", name: "n", rule: "r" }] },
        ],
      }),
    ).toEqual([]);
  });
});

describe("formatSummary disagreements line", () => {
  const base = {
    command: "repo-scan" as const,
    repo: "octocat/hello-world",
    cloneUrl: "https://github.com/octocat/hello-world.git",
    ref: "abc123",
    skipped: false,
    markdownFiles: 1,
  };

  test("shows the count when present, even zero", () => {
    expect(formatSummary({ ...base, disagreements: [] })).toContain("  disagreements: 0");
  });

  test("mentions --files when there are hits", () => {
    const report: ScanReport = {
      ...base,
      disagreements: [
        {
          path: "docs/deal.md",
          sheet: "runs",
          name: "premium_hours",
          rule: "premium_hours = on_call_hours - base_hours",
          rowLabel: "C.2",
          stored: "12",
          computed: "15",
        },
      ],
    };
    const line = formatSummary(report).find((l) => l.startsWith("  disagreements:"));
    expect(line).toContain("1");
    expect(line).toContain("--explain");
  });

  test("omitted entirely when disagreements is undefined (e.g. skipped scans)", () => {
    const lines = formatSummary({ ...base, skipped: true, skipReason: "x" });
    expect(lines.some((l) => l.includes("disagreements"))).toBe(false);
  });
});

describe("formatDisagreements", () => {
  test("empty when none", () => {
    const report: ScanReport = {
      command: "repo-scan",
      repo: "r",
      cloneUrl: "u",
      ref: null,
      skipped: false,
      markdownFiles: 0,
      disagreements: [],
    };
    expect(formatDisagreements(report)).toEqual([]);
  });

  test("one line per disagreement, naming file, column, row, and the mismatch", () => {
    const report: ScanReport = {
      command: "repo-scan",
      repo: "r",
      cloneUrl: "u",
      ref: null,
      skipped: false,
      markdownFiles: 1,
      disagreements: [
        {
          path: "docs/deal.md",
          sheet: "runs",
          name: "premium_hours",
          rule: "premium_hours = on_call_hours - base_hours",
          rowLabel: "C.2",
          stored: "12",
          computed: "15",
        },
      ],
    };
    const lines = formatDisagreements(report);
    expect(lines[0]).toBe("  disagreements:");
    expect(lines[1]).toContain("docs/deal.md");
    expect(lines[1]).toContain("runs.premium_hours");
    expect(lines[1]).toContain("row C.2");
    expect(lines[1]).toContain("stored 12");
    expect(lines[1]).toContain("computes 15");
  });
});

describe("formatExplain", () => {
  const report: ScanReport = {
    command: "repo-scan",
    repo: "octocat/hello-world",
    cloneUrl: "https://github.com/octocat/hello-world.git",
    ref: "abc123",
    skipped: false,
    markdownFiles: 1,
    check: {
      summary: { files: 1, problems: 1, stale: 0, errors: 1 },
      files: [
        {
          path: "docs/AGENTS.md",
          findings: [
            {
              code: "COVERAGE",
              location: { file: "docs/AGENTS.md" },
              details: {
                message: "a table with no `vmark` rules — nothing in this document is checked",
              },
            },
          ],
        },
      ],
    },
    infer: {
      summary: { files: 1, rules: 1, scalars: 0, anchors: 0 },
      files: [
        {
          path: "docs/AGENTS.md",
          proposals: [{ kind: "column", sheet: "lines", name: "net", rule: "net = qty * rate" }],
        },
        {
          path: "docs/deal.md",
          proposals: [
            {
              kind: "near-miss",
              sheet: "runs",
              name: "premium_hours",
              rule: "premium_hours = on_call_hours - base_hours",
              disagreement: { rowLabel: "C.2", stored: "12", computed: "15" },
            },
          ],
        },
      ],
    },
  };

  test("lists every finding and proposal under its file, not just counts", () => {
    const lines = formatExplain(report);
    expect(lines).toContain("    docs/AGENTS.md");
    expect(
      lines.some((l) => l.includes("[COVERAGE]") && l.includes("nothing in this document")),
    ).toBe(true);
    expect(lines.some((l) => l.includes("[column] lines.net — net = qty * rate"))).toBe(true);
    expect(
      lines.some(
        (l) => l.includes("[near-miss]") && l.includes("row C.2") && l.includes("computes 15"),
      ),
    ).toBe(true);
  });

  test("empty when skipped or nothing found", () => {
    expect(formatExplain({ ...report, skipped: true, skipReason: "x" })).toEqual([]);
    expect(
      formatExplain({
        ...report,
        check: { summary: { files: 1 }, files: [{ path: "a.md", findings: [] }] },
        infer: { summary: { files: 1 }, files: [{ path: "a.md", proposals: [] }] },
      }),
    ).toEqual([]);
  });

  test("routes each category through its own palette function", () => {
    const seen: string[] = [];
    const palette: Palette = {
      finding: (s) => {
        seen.push(`finding:${s}`);
        return s;
      },
      proposal: (s) => {
        seen.push(`proposal:${s}`);
        return s;
      },
      disagreement: (s) => {
        seen.push(`disagreement:${s}`);
        return s;
      },
    };
    formatExplain(report, palette);
    expect(seen.some((s) => s.startsWith("finding:[COVERAGE]"))).toBe(true);
    expect(seen.some((s) => s.startsWith("proposal:[column]"))).toBe(true);
    expect(seen.some((s) => s.startsWith("disagreement:[near-miss]"))).toBe(true);
  });
});

describe("formatFiles and formatDisagreements color routing", () => {
  test("formatFiles sends its counts through palette.finding/proposal", () => {
    const seen: string[] = [];
    const palette: Palette = {
      finding: (s) => {
        seen.push(s);
        return `F(${s})`;
      },
      proposal: (s) => {
        seen.push(s);
        return `P(${s})`;
      },
      disagreement: (s) => s,
    };
    const report: ScanReport = {
      command: "repo-scan",
      repo: "r",
      cloneUrl: "u",
      ref: null,
      skipped: false,
      markdownFiles: 1,
      check: {
        summary: { files: 1, problems: 1, stale: 0, errors: 0 },
        files: [{ path: "a.md", findings: [{ code: "COVERAGE" }] }],
      },
    };
    const lines = formatFiles(report, palette);
    expect(lines.join("\n")).toContain("F(1 finding(s))");
  });

  test("formatDisagreements sends each line through palette.disagreement", () => {
    const report: ScanReport = {
      command: "repo-scan",
      repo: "r",
      cloneUrl: "u",
      ref: null,
      skipped: false,
      markdownFiles: 1,
      disagreements: [
        {
          path: "docs/deal.md",
          sheet: "runs",
          name: "premium_hours",
          rule: "premium_hours = on_call_hours - base_hours",
          rowLabel: "C.2",
          stored: "12",
          computed: "15",
        },
      ],
    };
    const palette: Palette = {
      finding: (s) => s,
      proposal: (s) => s,
      disagreement: (s) => `D(${s})`,
    };
    const lines = formatDisagreements(report, palette);
    expect(lines[1]).toStartWith("    D(");
  });
});
