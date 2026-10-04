import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const scripts = import.meta.dir;
const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "release-checks-"));
  temps.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

function run(script: string, ...args: string[]): { code: number; out: string } {
  const r = Bun.spawnSync(["bun", join(scripts, script), ...args]);
  return { code: r.exitCode, out: r.stdout.toString() };
}

const json = (v: unknown): string => JSON.stringify(v, null, 2) + "\n";

describe("check-mcp-name", () => {
  const files = (mcpName: string | undefined, name: string) => ({
    "packages/visimark-mcp/package.json": json({ name: "visimark-mcp", mcpName }),
    "server.json": json({ name }),
  });

  test("passes when the names agree", () => {
    expect(run("check-mcp-name.ts", tree(files("io.github.a/b", "io.github.a/b"))).code).toBe(0);
  });

  test("fails when they differ", () => {
    const r = run("check-mcp-name.ts", tree(files("io.github.a/b", "io.github.a/c")));
    expect(r.code).toBe(1);
    expect(r.out).toContain("::error file=packages/visimark-mcp/package.json::");
  });

  test("fails when mcpName is missing", () => {
    const r = run("check-mcp-name.ts", tree(files(undefined, "io.github.a/b")));
    expect(r.code).toBe(1);
    expect(r.out).toContain('no "mcpName"');
  });

  test("fails when server.json is unreadable", () => {
    const root = tree({ "packages/visimark-mcp/package.json": json({ mcpName: "x/y" }) });
    expect(run("check-mcp-name.ts", root).code).toBe(1);
  });

  test("exits 2 on extra arguments", () => {
    expect(run("check-mcp-name.ts", "a", "b").code).toBe(2);
  });

  test("passes on the real repository", () => {
    expect(run("check-mcp-name.ts").code).toBe(0);
  });
});

describe("check-obsidian-root-mirror", () => {
  const mirrored = {
    "manifest.json": '{"version":"1"}\n',
    "editors/obsidian/manifest.json": '{"version":"1"}\n',
    "versions.json": '{"1":"1.8.7"}\n',
    "editors/obsidian/versions.json": '{"1":"1.8.7"}\n',
  };

  test("passes when the copies are byte-equal", () => {
    expect(run("check-obsidian-root-mirror.ts", tree(mirrored)).code).toBe(0);
  });

  test("fails on a one-byte difference, naming the root file", () => {
    const r = run(
      "check-obsidian-root-mirror.ts",
      tree({ ...mirrored, "versions.json": '{"1":"1.8.7"}' }),
    );
    expect(r.code).toBe(1);
    expect(r.out).toContain("::error file=versions.json::");
    expect(r.out).not.toContain("file=manifest.json");
  });

  test("fails when a copy is missing", () => {
    const { "editors/obsidian/manifest.json": _, ...rest } = mirrored;
    expect(run("check-obsidian-root-mirror.ts", tree(rest)).code).toBe(1);
  });

  test("passes on the real repository", () => {
    expect(run("check-obsidian-root-mirror.ts").code).toBe(0);
  });
});

describe("check-obsidian-engine-line", () => {
  const files = (claim: string, engine = "0.1.10") => ({
    "packages/visimark/package.json": json({ version: engine }),
    "editors/obsidian/CHANGELOG.md": `# Changelog\n\n## Unreleased\n\n## 0.2.2 - 2026-09-28\n\nText.\n\n${claim}\n\n## 0.2.1 - 2026-09-27\n\nBundles engine 0.1.9.\n`,
  });

  test("passes when the newest entry names the tree's engine", () => {
    expect(run("check-obsidian-engine-line.ts", tree(files("Bundles engine 0.1.10."))).code).toBe(
      0,
    );
  });

  test("fails when a core bump left the line behind", () => {
    const r = run("check-obsidian-engine-line.ts", tree(files("Bundles engine 0.1.10.", "0.1.11")));
    expect(r.code).toBe(1);
    expect(r.out).toContain("0.1.10");
    expect(r.out).toContain("0.1.11");
  });

  test("only reads the newest dated entry, not older ones", () => {
    // 0.2.1 says 0.1.9, which must not matter.
    expect(run("check-obsidian-engine-line.ts", tree(files("Bundles engine 0.1.10."))).code).toBe(
      0,
    );
  });

  test("fails when the newest entry has no engine line", () => {
    const r = run("check-obsidian-engine-line.ts", tree(files("No line here.")));
    expect(r.code).toBe(1);
    expect(r.out).toContain("Bundles engine");
  });

  // No "passes on the real repository" case, on purpose: this check runs in
  // obsidian-release.yml only, because a core-only bump leaves the plugin
  // changelog one engine version behind until the plugin ships (releasing.md,
  // "Release order"). Asserting it against the live tree turned ci red on the
  // v0.2.0 release commit.
});

describe("changelog-section", () => {
  const changelog = [
    "# Changelog",
    "",
    "## Unreleased",
    "",
    "## 0.2.0 - 2026-09-02",
    "",
    "### Added",
    "",
    "- New.",
    "",
    "## 0.1.0 - 2026-09-01",
    "",
    "Old.",
    "",
    "[0.2.0]: https://example.com/0.2.0",
    "[0.1.0]: https://example.com/0.1.0",
    "",
  ].join("\n");
  const file = () => join(tree({ "CHANGELOG.md": changelog }), "CHANGELOG.md");

  test("prints only the requested section, without its heading", () => {
    const r = run("changelog-section.ts", file(), "0.2.0");
    expect(r.code).toBe(0);
    expect(r.out).toBe("### Added\n\n- New.\n");
  });

  test("drops the trailing link references from the last section", () => {
    expect(run("changelog-section.ts", file(), "0.1.0").out).toBe("Old.\n");
  });

  test("does not match a version that is a prefix of another", () => {
    expect(run("changelog-section.ts", file(), "0.2").code).toBe(1);
  });

  test("fails on a missing version", () => {
    const r = run("changelog-section.ts", file(), "9.9.9");
    expect(r.code).toBe(1);
    expect(r.out).toContain("::error");
  });

  test("fails on an empty section", () => {
    const f = join(
      tree({ "C.md": "## 1.0.0 - 2026-01-01\n\n## 0.9.0 - 2025-12-31\n\nx\n" }),
      "C.md",
    );
    expect(run("changelog-section.ts", f, "1.0.0").code).toBe(1);
  });

  test("exits 2 without both arguments", () => {
    expect(run("changelog-section.ts", "CHANGELOG.md").code).toBe(2);
  });

  test("extracts the newest real entry", () => {
    expect(run("changelog-section.ts", join(scripts, "..", "CHANGELOG.md"), "0.1.10").code).toBe(0);
  });
});
