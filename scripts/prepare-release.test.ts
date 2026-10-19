import { afterEach, describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { OBSIDIAN_MANIFEST, OBSIDIAN_VERSIONS } from "./release-manifests.ts";

const repo = join(import.meta.dir, "..");
const script = join(import.meta.dir, "prepare-release.ts");
const FILES = [
  "packages/visimark/package.json",
  "packages/visimark-lsp/package.json",
  "editors/vscode/package.json",
  "packages/remark-visimark/package.json",
  "packages/markdownlint-visimark/package.json",
  "packages/visimark-mcp/package.json",
  "packages/codemirror-visimark/package.json",
  "packages/markdown-it-visimark/package.json",
  "action.yml",
  "scripts/precommit-visimark-check.sh",
  "server.json",
  "bun.lock",
  "CHANGELOG.md",
  "editors/vscode/CHANGELOG.md",
  OBSIDIAN_MANIFEST,
  OBSIDIAN_VERSIONS,
  "manifest.json",
  "versions.json",
  "editors/obsidian/CHANGELOG.md",
];

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const read = (root: string, file: string): string => readFileSync(join(root, file), "utf8");
const current = (): string => JSON.parse(read(repo, "packages/visimark/package.json")).version;

/** A temp tree of the real release files, so the layout it edits is the real one. */
function tree(
  unreleased = "### Fixed\n\n- Something.\n",
  editorUnreleased?: string,
  pluginUnreleased = "",
): string {
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
  // The plugin starts in lockstep with the engine, which check-versions
  // requires. The real tree may not be there yet: until v0.4.0 it is plugin
  // 0.3.0 against engine 0.2.0. Pin it, so no test depends on which side of
  // that release it runs on.
  const engine = current();
  const manifest = JSON.parse(read(root, OBSIDIAN_MANIFEST));
  const manifestText = read(root, OBSIDIAN_MANIFEST).replace(
    /^(\s*"version": ")[^"]+(",?)$/m,
    `$1${engine}$2`,
  );
  // A lockstep versions.json has no key above the engine; the plugin's own
  // line (0.2.1 to 0.3.0) left some, which would collide with `next`.
  const notAbove = (v: string): boolean => {
    const [x, y] = [v, engine].map((s) => s.split(".").map(Number));
    return x!.reduce((acc, n, i) => acc || n - y![i]!, 0) <= 0;
  };
  const versions = Object.entries(
    JSON.parse(read(root, OBSIDIAN_VERSIONS)) as Record<string, string>,
  );
  const versionsText =
    JSON.stringify(
      {
        ...Object.fromEntries(versions.filter(([v]) => notAbove(v))),
        [engine]: manifest.minAppVersion,
      },
      null,
      2,
    ) + "\n";
  for (const [a, b, text] of [
    [OBSIDIAN_MANIFEST, "manifest.json", manifestText],
    [OBSIDIAN_VERSIONS, "versions.json", versionsText],
  ] as const) {
    writeFileSync(join(root, a), text);
    writeFileSync(join(root, b), text);
  }
  const plugin = read(root, "editors/obsidian/CHANGELOG.md").replace(
    /^## Unreleased[ \t]*\n[\s\S]*?(?=^## )/m,
    pluginUnreleased === "" ? "## Unreleased\n\n" : `## Unreleased\n\n${pluginUnreleased}\n`,
  );
  writeFileSync(join(root, "editors/obsidian/CHANGELOG.md"), plugin);
  return root;
}

const snapshot = (root: string): string[] => FILES.map((f) => read(root, f));
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
    expect(hook.match(new RegExp(`^pinned=${next}$`, "gm"))).toHaveLength(1);
    expect(hook).not.toContain(`pinned=${current()}`);
    const server = JSON.parse(read(root, "server.json"));
    expect(server.version).toBe(next);
    expect(server.packages[0].version).toBe(next);
  });

  test("leaves workspace:* dependencies alone", () => {
    const root = tree();
    runAt(root, next);
    expect(JSON.parse(read(root, "packages/visimark-lsp/package.json")).dependencies.visimark).toBe(
      "workspace:*",
    );
  });

  test("bumps bun.lock's mirrored version and visimark pins, scoped to the right workspace", () => {
    const root = tree();
    expect(runAt(root, next).code).toBe(0);
    const lock = read(root, "bun.lock");
    for (const workspace of [
      "packages/visimark",
      "packages/visimark-lsp",
      "editors/vscode",
      "packages/remark-visimark",
      "packages/markdownlint-visimark",
      "packages/visimark-mcp",
      "packages/codemirror-visimark",
      "packages/markdown-it-visimark",
    ]) {
      const block =
        new RegExp(`"${workspace}": \\{[\\s\\S]*?\\n    \\},?\\n`).exec(lock)?.[0] ?? "";
      expect(block).toContain(`"version": "${next}"`);
    }
    // packages/visimark-lsp and packages/visimark-mcp share "visimark" as a
    // prefix; each block's own pin (or workspace:* for the lsp) must move,
    // and no block may pick up a different workspace's version by accident.
    const lspBlock = /"packages\/visimark-lsp": \{[\s\S]*?\n    \},?\n/.exec(lock)![0]!;
    expect(lspBlock).toContain('"visimark": "workspace:*"');
    const mcpBlock = /"packages\/visimark-mcp": \{[\s\S]*?\n    \},?\n/.exec(lock)![0]!;
    expect(mcpBlock).toContain(`"visimark": "${next}"`);
    expect(lock.match(new RegExp(`"visimark": "${next}"`, "g"))).toHaveLength(3);
  });

  test("refuses, writing nothing, when a bun.lock block is missing its version — rather than editing the next workspace's", () => {
    const root = tree();
    const lock = read(root, "bun.lock");
    // Strip just packages/visimark-lsp's "version" line; editors/vscode (the
    // very next block) keeps its own "version" field right after it, which is
    // exactly what an unbounded lazy match could wander into instead.
    const stripped = lock.replace(
      /("packages\/visimark-lsp": \{\n {6}"name": "visimark-lsp",\n) {6}"version": "[^"]+",\n/,
      "$1",
    );
    expect(stripped).not.toBe(lock);
    writeFileSync(join(root, "bun.lock"), stripped);
    const before = snapshot(root);
    const r = runAt(root, next);
    expect(r.code).toBe(1);
    expect(r.out).toContain("packages/visimark-lsp");
    expect(snapshot(root)).toEqual(before);
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

  describe("the Obsidian plugin", () => {
    const min = (root: string): string => JSON.parse(read(root, OBSIDIAN_MANIFEST)).minAppVersion;

    test("bumps both manifests to the new version, byte-equal", () => {
      const root = tree();
      expect(runAt(root, next).code).toBe(0);
      expect(JSON.parse(read(root, OBSIDIAN_MANIFEST)).version).toBe(next);
      expect(read(root, "manifest.json")).toBe(read(root, OBSIDIAN_MANIFEST));
    });

    test("appends the new version to versions.json as its last key, in both copies", () => {
      const root = tree();
      expect(runAt(root, next).code).toBe(0);
      const versions = read(root, OBSIDIAN_VERSIONS);
      expect(versions.endsWith(`,\n  "${next}": "${min(root)}"\n}\n`)).toBe(true);
      expect(Object.keys(JSON.parse(versions)).at(-1)).toBe(next);
      expect(read(root, "versions.json")).toBe(versions);
    });

    test("an empty Unreleased gets the placeholder entry and stays", () => {
      const root = tree();
      runAt(root, next, "--date", "2030-01-02");
      expect(read(root, "editors/obsidian/CHANGELOG.md")).toContain(
        `## Unreleased\n\n## ${next} - 2030-01-02\n\nNo plugin changes. Bundles engine ${next}.\n\n## `,
      );
    });

    test("a whitespace-only Unreleased counts as empty", () => {
      const root = tree(undefined, undefined, "   \n\n");
      runAt(root, next, "--date", "2030-01-02");
      expect(read(root, "editors/obsidian/CHANGELOG.md")).toContain(
        `## ${next} - 2030-01-02\n\nNo plugin changes. Bundles engine ${next}.`,
      );
    });

    test("with no Unreleased, the placeholder goes above the newest entry and none is invented", () => {
      const root = tree();
      const file = join(root, "editors/obsidian/CHANGELOG.md");
      writeFileSync(
        file,
        read(root, "editors/obsidian/CHANGELOG.md").replace(/^## Unreleased\n+/m, ""),
      );
      expect(runAt(root, next, "--date", "2030-01-02").code).toBe(0);
      const text = read(root, "editors/obsidian/CHANGELOG.md");
      expect(text).not.toContain("## Unreleased");
      // the placeholder is the first "## " heading, above every older entry
      expect(text.slice(text.indexOf("\n## ") + 1)).toStartWith(
        `## ${next} - 2030-01-02\n\nNo plugin changes. Bundles engine ${next}.\n\n## `,
      );
    });

    test("an Unreleased with content is dated, reopened above, and gets no placeholder", () => {
      const root = tree(undefined, undefined, "- Something.\n");
      runAt(root, next, "--date", "2030-01-02");
      const text = read(root, "editors/obsidian/CHANGELOG.md");
      expect(text).toContain(`## Unreleased\n\n## ${next} - 2030-01-02\n\n- Something.\n`);
      expect(text).not.toContain(`No plugin changes. Bundles engine ${next}.`);
    });

    test("refuses a version that is not newer than the plugin's, writing nothing", () => {
      // spec §4 session 4: the plugin sits where MINOR would land
      const root = tree("### Added\n\n- Something new.\n");
      const ahead = minorOf(current());
      for (const f of [OBSIDIAN_MANIFEST, "manifest.json"]) {
        writeFileSync(
          join(root, f),
          read(root, f).replace(/^(\s*"version": ")[^"]+/m, `$1${ahead}`),
        );
      }
      const before = snapshot(root);
      const r = runAt(root, "MINOR");
      expect(r.code).toBe(1);
      expect(r.out).toContain(
        `::error file=${OBSIDIAN_MANIFEST}::${ahead} is not newer than the Obsidian plugin's current version ${ahead}.`,
      );
      expect(snapshot(root)).toEqual(before);
    });

    test("an explicit version past the plugin's is accepted, in 19 files", () => {
      // spec §4 session 5: the one-time skip
      const root = tree("### Added\n\n- Something new.\n");
      const ahead = minorOf(current());
      for (const f of [OBSIDIAN_MANIFEST, "manifest.json"]) {
        writeFileSync(
          join(root, f),
          read(root, f).replace(/^(\s*"version": ")[^"]+/m, `$1${ahead}`),
        );
      }
      const skip = minorOf(ahead);
      const r = runAt(root, skip, "--date", "2030-01-02");
      expect(r.code).toBe(0);
      expect(r.out).toContain(`Prepared ${current()} -> ${skip} (2030-01-02, MINOR) in 19 files.`);
      expect(r.out).toContain(`commit as "chore: release v${skip}".`);
      expect(r.out).not.toContain("The Obsidian plugin is not touched.");
    });

    for (const file of ["manifest.json", "versions.json"]) {
      test(`refuses when the root ${file} has drifted, writing nothing`, () => {
        const root = tree();
        writeFileSync(join(root, file), read(root, file) + " ");
        const before = snapshot(root);
        const r = runAt(root, next);
        expect(r.code).toBe(1);
        expect(r.out).toContain(
          `::error file=${file}::${file} differs from editors/obsidian/${file}. Make the root copies byte-equal first — see scripts/check-obsidian-root-mirror.ts.`,
        );
        expect(snapshot(root)).toEqual(before);
      });
    }

    test("refuses when versions.json already has the new key, writing nothing", () => {
      const root = tree();
      const v =
        JSON.stringify({ ...JSON.parse(read(root, OBSIDIAN_VERSIONS)), [next]: "1.8.7" }, null, 2) +
        "\n";
      writeFileSync(join(root, OBSIDIAN_VERSIONS), v);
      writeFileSync(join(root, "versions.json"), v);
      const before = snapshot(root);
      const r = runAt(root, next);
      expect(r.code).toBe(1);
      expect(r.out).toContain(
        `::error file=${OBSIDIAN_VERSIONS}::${OBSIDIAN_VERSIONS} already has a "${next}" key.`,
      );
      expect(snapshot(root)).toEqual(before);
    });

    test("refuses when minAppVersion is missing, writing nothing", () => {
      const root = tree();
      const m = read(root, OBSIDIAN_MANIFEST).replace(/^\s*"minAppVersion": "[^"]*",?\n/m, "");
      writeFileSync(join(root, OBSIDIAN_MANIFEST), m);
      writeFileSync(join(root, "manifest.json"), m);
      const before = snapshot(root);
      const r = runAt(root, next);
      expect(r.code).toBe(1);
      expect(r.out).toContain('cannot find "minAppVersion"');
      expect(snapshot(root)).toEqual(before);
    });

    test("refuses a versions.json with no entry to append after, writing nothing", () => {
      const root = tree();
      writeFileSync(join(root, OBSIDIAN_VERSIONS), "{}\n");
      writeFileSync(join(root, "versions.json"), "{}\n");
      const before = snapshot(root);
      const r = runAt(root, next);
      expect(r.code).toBe(1);
      expect(r.out).toContain(OBSIDIAN_VERSIONS);
      expect(snapshot(root)).toEqual(before);
    });

    test("leaves a tree every release check passes on", () => {
      // spec §4 session 9
      const root = tree();
      expect(runAt(root, next, "--date", "2030-01-02").code).toBe(0);
      for (const check of [
        "check-versions.ts",
        "check-changelog-entries.ts",
        "check-obsidian-root-mirror.ts",
      ]) {
        const r = Bun.spawnSync(["bun", join(import.meta.dir, check), root]);
        expect({ check, code: r.exitCode }).toEqual({ check, code: 0 });
      }
    });
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

  test("refuses when the pre-commit pin is no longer numeric", () => {
    const root = tree();
    const file = join(root, "scripts/precommit-visimark-check.sh");
    writeFileSync(
      file,
      read(root, "scripts/precommit-visimark-check.sh").replace(/^pinned=\S+$/m, "pinned=latest"),
    );
    const before = snapshot(root);
    const r = runAt(root, next);
    expect(r.code).toBe(1);
    expect(r.out).toContain("exactly one numeric");
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

    test("refuses MINOR when the Added heading has no entry under it, writing nothing", () => {
      const root = tree("### Fixed\n\n- Bug fix.\n\n### Added\n");
      const before = snapshot(root);
      const r = runAt(root, "MINOR");
      expect(r.code).toBe(1);
      expect(r.out).toContain("MINOR bump");
      expect(snapshot(root)).toEqual(before);
    });

    test("refuses MAJOR when the Removed heading has no entry under it, writing nothing", () => {
      const root = tree("### Added\n\n- Something new.\n\n### Removed\n");
      const before = snapshot(root);
      const r = runAt(root, "MAJOR");
      expect(r.code).toBe(1);
      expect(r.out).toContain("MAJOR bump");
      expect(snapshot(root)).toEqual(before);
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
