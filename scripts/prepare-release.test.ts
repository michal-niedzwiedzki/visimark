import { afterEach, describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const repo = join(import.meta.dir, "..");
const script = join(import.meta.dir, "prepare-release.ts");
const FILES = [
  "packages/visimark/package.json",
  "packages/visimark-lsp/package.json",
  "editors/vscode/package.json",
  "packages/remark-visimark/package.json",
  "packages/markdownlint-visimark/package.json",
  "packages/visimark-mcp/package.json",
  "action.yml",
  "scripts/precommit-visimark-check.sh",
  "CHANGELOG.md",
  "editors/vscode/CHANGELOG.md",
];

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A temp tree of the real release files, so the layout it edits is the real one. */
function tree(unreleased = "### Fixed\n\n- Something.\n", editorUnreleased?: string): string {
  const root = mkdtempSync(join(tmpdir(), "prepare-release-"));
  temps.push(root);
  for (const file of FILES) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    cpSync(join(repo, file), join(root, file));
  }
  const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  writeFileSync(
    join(root, "CHANGELOG.md"),
    changelog.replace(/^## Unreleased\n[\s\S]*?(?=^## )/m, `## Unreleased\n\n${unreleased}\n`),
  );
  // the editor changelog's `## Unreleased` is optional (docs/releasing.md), so
  // the real file may or may not carry one — pin it either way
  const editor = readFileSync(join(root, "editors/vscode/CHANGELOG.md"), "utf8").replace(
    /^## Unreleased\n[\s\S]*?(?=^## )/m,
    "",
  );
  writeFileSync(
    join(root, "editors/vscode/CHANGELOG.md"),
    editorUnreleased === undefined
      ? editor
      : editor.replace(/^## /m, `## Unreleased\n\n${editorUnreleased}\n## `),
  );
  return root;
}

const read = (root: string, file: string): string => readFileSync(join(root, file), "utf8");
const snapshot = (root: string): string[] => FILES.map((f) => read(root, f));
const current = (): string => JSON.parse(read(repo, "packages/visimark/package.json")).version;
const fixOf = (v: string): string => {
  const [a, b, c] = v.split(".").map(Number);
  return `${a}.${b}.${c! + 1}`;
};
const minorOf = (v: string): string => {
  const [a, b] = v.split(".").map(Number);
  return `${a}.${b! + 1}.0`;
};
const majorOf = (v: string): string => {
  const [a] = v.split(".").map(Number);
  return `${a! + 1}.0.0`;
};

// Every test runs against a temp tree via --root; a call with no --root would
// default to the real repository, which must never happen from this suite.
function run(...args: string[]): { code: number; out: string } {
  const r = Bun.spawnSync(["bun", script, ...args]);
  return { code: r.exitCode, out: r.stdout.toString() + r.stderr.toString() };
}
function runAt(root: string, ...args: string[]): { code: number; out: string } {
  return run(...args, "--root", root);
}

describe("prepare-release", () => {
  const next = fixOf(current());

  test("bumps every version-carrying file to the new version", () => {
    const root = tree();
    expect(runAt(root, next, "--date", "2030-01-02").code).toBe(0);
    for (const file of FILES.filter((f) => f.endsWith("package.json"))) {
      expect(JSON.parse(read(root, file)).version).toBe(next);
    }
    for (const file of FILES.filter(
      (f) => /remark|markdownlint|mcp/.test(f) && f.endsWith("package.json"),
    )) {
      expect(JSON.parse(read(root, file)).dependencies.visimark).toBe(next);
    }
    expect(read(root, "action.yml")).toContain(`default: "${next}"`);
    const hook = read(root, "scripts/precommit-visimark-check.sh");
    expect(hook.match(new RegExp(`visimark@${next}`, "g"))).toHaveLength(2);
    expect(hook).not.toContain(`visimark@${current()}`);
  });

  test("leaves workspace:* dependencies alone", () => {
    const root = tree();
    runAt(root, next);
    expect(JSON.parse(read(root, "packages/visimark-lsp/package.json")).dependencies.visimark).toBe(
      "workspace:*",
    );
  });

  test("turns the changelogs over", () => {
    const root = tree();
    runAt(root, next, "--date", "2030-01-02");
    const changelog = read(root, "CHANGELOG.md");
    expect(changelog).toContain(`## Unreleased\n\n## ${next} - 2030-01-02\n\n### Fixed`);
    expect(changelog).toContain(
      `[${next}]: https://github.com/michal-niedzwiedzki/visimark/releases/tag/v${next}\n[${current()}]:`,
    );
    expect(read(root, "editors/vscode/CHANGELOG.md")).toContain(
      `## ${next} - 2030-01-02\n\nNo editor-visible changes. Bundles engine ${next}.`,
    );
  });

  test("dates an editor changelog's own Unreleased section instead of the placeholder", () => {
    const root = tree(undefined, "- An editor-visible change.\n");
    runAt(root, next, "--date", "2030-01-02");
    const editor = read(root, "editors/vscode/CHANGELOG.md");
    expect(editor).toContain(`## ${next} - 2030-01-02\n\n- An editor-visible change.\n`);
    expect(editor).not.toContain("## Unreleased");
    expect(editor).not.toContain("No editor-visible changes. Bundles engine " + next);
  });

  test("refuses a version that is not newer, writing nothing", () => {
    const root = tree();
    const before = snapshot(root);
    for (const v of [current(), "0.0.1"]) {
      const r = runAt(root, v);
      expect(r.code).toBe(1);
      expect(r.out).toContain("not newer");
    }
    expect(snapshot(root)).toEqual(before);
  });

  test("refuses an empty Unreleased section, writing nothing", () => {
    const root = tree("");
    const before = snapshot(root);
    const r = runAt(root, next);
    expect(r.code).toBe(1);
    expect(r.out).toContain("nothing to release");
    expect(snapshot(root)).toEqual(before);
  });

  test("writes nothing when a later file has an unexpected layout", () => {
    const root = tree();
    writeFileSync(join(root, "scripts/precommit-visimark-check.sh"), "no pin here\n");
    const before = snapshot(root);
    const r = runAt(root, next);
    expect(r.code).toBe(1);
    expect(r.out).toContain("precommit-visimark-check.sh");
    expect(snapshot(root)).toEqual(before);
  });

  test("exits 2 on a malformed version or date", () => {
    expect(run("1.2").code).toBe(2);
    expect(runAt(tree(), next, "--date", "yesterday").code).toBe(2);
    expect(run("not-a-version-or-bump-word").code).toBe(2);
  });

  test("exits 2 on a version with a leading zero, which npm refuses", () => {
    expect(run("01.2.3").code).toBe(2);
    expect(run("1.02.3").code).toBe(2);
  });

  test("exits 2 on a date that has the shape but not the calendar", () => {
    const root = tree();
    const before = snapshot(root);
    for (const d of ["2030-02-30", "2030-13-01", "2030-00-10"]) {
      expect(runAt(root, next, "--date", d).code).toBe(2);
    }
    expect(snapshot(root)).toEqual(before);
  });

  test("refuses when action.yml's version input has lost its default", () => {
    const root = tree();
    const action = read(root, "action.yml").replace(
      /(^  version:[\s\S]*?)^    default: .*\n/m,
      "$1",
    );
    writeFileSync(join(root, "action.yml"), action);
    const before = snapshot(root);
    const r = runAt(root, next);
    expect(r.code).toBe(1);
    expect(r.out).toContain("action.yml");
    expect(snapshot(root)).toEqual(before);
  });

  test("refuses when one pre-commit pin is no longer numeric", () => {
    const root = tree();
    const file = join(root, "scripts/precommit-visimark-check.sh");
    writeFileSync(
      file,
      read(root, "scripts/precommit-visimark-check.sh").replace(
        /npx --yes visimark@\S+/,
        "npx --yes visimark@latest",
      ),
    );
    const before = snapshot(root);
    const r = runAt(root, next);
    expect(r.code).toBe(1);
    expect(r.out).toContain("exactly two numeric");
    expect(snapshot(root)).toEqual(before);
  });

  describe("FIX|MINOR|MAJOR bump words", () => {
    test("defaults to FIX when no spec is given", () => {
      const root = tree();
      const r = runAt(root);
      expect(r.code).toBe(0);
      expect(JSON.parse(read(root, "packages/visimark/package.json")).version).toBe(next);
      expect(r.out).toContain(`Prepared ${current()} -> ${next}`);
      expect(r.out).toContain("FIX");
    });

    test("FIX, MINOR and MAJOR are case-insensitive and compute the matching version", () => {
      for (const [word, want, unreleased] of [
        ["fix", fixOf(current()), "### Fixed\n\n- Something.\n"],
        ["Minor", minorOf(current()), "### Added\n\n- Something new.\n"],
        ["MAJOR", majorOf(current()), "### Removed\n\n- Something gone.\n"],
      ] as const) {
        const root = tree(unreleased);
        const r = runAt(root, word);
        expect(r.code).toBe(0);
        expect(JSON.parse(read(root, "packages/visimark/package.json")).version).toBe(want);
      }
    });

    test("refuses MINOR against a Fixed-only Unreleased section, writing nothing", () => {
      const root = tree("### Fixed\n\n- Bug fix.\n");
      const before = snapshot(root);
      const r = runAt(root, "MINOR");
      expect(r.code).toBe(1);
      expect(r.out).toContain("MINOR bump");
      expect(r.out).toContain('"### Added"');
      expect(snapshot(root)).toEqual(before);
    });

    test("refuses MAJOR against an Added-only Unreleased section, writing nothing", () => {
      const root = tree("### Added\n\n- Something new.\n");
      const before = snapshot(root);
      const r = runAt(root, "MAJOR");
      expect(r.code).toBe(1);
      expect(r.out).toContain("MAJOR bump");
      expect(r.out).toContain('"### Removed"');
      expect(snapshot(root)).toEqual(before);
    });

    test("allows MINOR or FIX, not just MAJOR, when Removed is present", () => {
      const root = tree("### Removed\n\n- Something gone.\n");
      expect(runAt(root, "MINOR").code).toBe(0);
    });

    test("an explicit X.Y.Z is held to the same rule as the matching bump word", () => {
      const root = tree("### Fixed\n\n- Bug fix.\n");
      const before = snapshot(root);
      const r = runAt(root, minorOf(current()));
      expect(r.code).toBe(1);
      expect(r.out).toContain("MINOR bump");
      expect(snapshot(root)).toEqual(before);
    });
  });
});
