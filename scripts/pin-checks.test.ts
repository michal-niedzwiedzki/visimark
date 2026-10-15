import { afterEach, describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { RELEASE_MANIFESTS } from "./release-manifests.ts";

const repo = join(import.meta.dir, "..");
const scripts = import.meta.dir;
const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A temp tree holding copies of `copy` from the real repository, then `files` on top. */
function tree(copy: string[], files: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "pin-checks-"));
  temps.push(root);
  for (const file of copy) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    cpSync(join(repo, file), join(root, file), { recursive: true });
  }
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
const real = (file: string): string => readFileSync(join(repo, file), "utf8");

describe("check-versions", () => {
  const COPY = [
    ...RELEASE_MANIFESTS.map((m) => m.file),
    "bun.lock",
    "action.yml",
    "scripts/precommit-visimark-check.sh",
    "server.json",
  ];

  test("passes on the real repository", () => {
    expect(run("check-versions.ts").code).toBe(0);
  });

  test("fails when a manifest's version drifts", () => {
    const file = "packages/markdown-it-visimark/package.json";
    const m = JSON.parse(real(file));
    const r = run("check-versions.ts", tree(COPY, { [file]: json({ ...m, version: "9.9.9" }) }));
    expect(r.code).toBe(1);
    expect(r.out).toContain(`::error file=${file}::`);
  });

  test("fails when an exact engine pin drifts", () => {
    const file = "packages/remark-visimark/package.json";
    const m = JSON.parse(real(file));
    const r = run(
      "check-versions.ts",
      tree(COPY, {
        [file]: json({ ...m, dependencies: { ...m.dependencies, visimark: "^0.0.1" } }),
      }),
    );
    expect(r.code).toBe(1);
    expect(r.out).toContain("dependencies.visimark");
  });

  test("fails when server.json is behind", () => {
    const s = JSON.parse(real("server.json"));
    const r = run(
      "check-versions.ts",
      tree(COPY, { "server.json": json({ ...s, version: "0.0.1" }) }),
    );
    expect(r.code).toBe(1);
    expect(r.out).toContain("::error file=server.json::");
  });

  test("fails when the pre-commit hook has two pins", () => {
    const hook = "scripts/precommit-visimark-check.sh";
    const r = run("check-versions.ts", tree(COPY, { [hook]: real(hook) + "pinned=0.0.1\n" }));
    expect(r.code).toBe(1);
    expect(r.out).toContain("exactly one pinned=");
  });

  test("fails when bun.lock's mirror of a workspace drifts", () => {
    const lock = real("bun.lock").replace(
      /("packages\/visimark-mcp": \{\n\s*"name": "visimark-mcp",\n\s*"version": ")[^"]+"/,
      '$10.0.1"',
    );
    const r = run("check-versions.ts", tree(COPY, { "bun.lock": lock }));
    expect(r.code).toBe(1);
    expect(r.out).toContain("bun.lock packages/visimark-mcp");
  });
});

describe("check-type-floors", () => {
  const lock = (node: string, vscode: string): string =>
    `{\n  "packages": {\n    "@types/node": ["@types/node@${node}", "", {}],\n    "@types/vscode": ["@types/vscode@${vscode}", "", {}],\n  }\n}\n`;
  const files = (node: string, vscode: string) => ({
    "bun.lock": lock(node, vscode),
    "packages/visimark/package.json": json({ engines: { node: ">=24" } }),
    "editors/vscode/package.json": json({ engines: { vscode: "^1.91.0" } }),
  });

  test("passes on the real repository", () => {
    expect(run("check-type-floors.ts").code).toBe(0);
  });

  test("passes at the floors", () => {
    expect(run("check-type-floors.ts", tree([], files("24.19.2", "1.91.0"))).code).toBe(0);
  });

  test("fails when @types/node's major is above engines.node", () => {
    const r = run("check-type-floors.ts", tree([], files("26.6.5", "1.91.0")));
    expect(r.code).toBe(1);
    expect(r.out).toContain("@types/node@26.6.5");
  });

  test("fails when @types/vscode is above engines.vscode", () => {
    const r = run("check-type-floors.ts", tree([], files("24.19.2", "1.138.0")));
    expect(r.code).toBe(1);
    expect(r.out).toContain("@types/vscode@1.138.0");
  });

  test("ignores a nested copy that belongs to a dependency", () => {
    const nested = lock("24.19.2", "1.91.0").replace(
      "  }\n}",
      '    "some-dep/@types/node": ["@types/node@20.1.0", "", {}],\n  }\n}',
    );
    const root = tree([], { ...files("24.19.2", "1.91.0"), "bun.lock": nested });
    expect(run("check-type-floors.ts", root).code).toBe(0);
  });
});

describe("check-overrides", () => {
  const files = (override: string, range: string) => ({
    "package.json": json({
      workspaces: ["packages/*"],
      overrides: { "@codemirror/view": override },
    }),
    "packages/a/package.json": json({ devDependencies: { "@codemirror/view": range } }),
    "packages/b/package.json": json({ dependencies: { "@codemirror/view": "workspace:*" } }),
  });

  test("passes on the real repository", () => {
    expect(run("check-overrides.ts").code).toBe(0);
  });

  test("passes when the override satisfies every range", () => {
    expect(run("check-overrides.ts", tree([], files("6.43.14", "^6.43.14"))).code).toBe(0);
  });

  test("fails when the override is below a declared range (#359 / #363)", () => {
    const r = run("check-overrides.ts", tree([], files("6.43.13", "^6.43.14")));
    expect(r.code).toBe(1);
    expect(r.out).toContain("::error file=packages/a/package.json::");
  });
});

describe("check-bun-policy", () => {
  const manifests = (bun: string | undefined) =>
    Object.fromEntries(
      RELEASE_MANIFESTS.filter((m) => m.npm !== null).map((m) => [
        m.file,
        json({ engines: bun === undefined ? {} : { bun } }),
      ]),
    );
  const base = (bun: string | undefined, workflows: Record<string, string> = {}) => ({
    "package.json": json({ packageManager: "bun@1.4.2" }),
    ...manifests(bun),
    ".github/workflows/release.yml":
      "      - uses: x\n        with:\n          bun-version-file: package.json\n",
    ".github/workflows/obsidian-release.yml":
      "      - uses: x\n        with:\n          bun-version-file: package.json\n",
    ...workflows,
  });

  test("passes on the real repository", () => {
    expect(run("check-bun-policy.ts").code).toBe(0);
  });

  test("passes when every floor and pin agrees", () => {
    const root = tree(
      [],
      base(">=1.4.2", {
        ".github/workflows/ci.yml":
          "    container: oven/bun:1.4.2\n          bun-version: latest\n",
      }),
    );
    expect(run("check-bun-policy.ts", root).code).toBe(0);
  });

  test("fails on an engines.bun floor nothing runs", () => {
    const r = run("check-bun-policy.ts", tree([], base(">=1.0.0")));
    expect(r.code).toBe(1);
    expect(r.out).toContain('engines.bun ">=1.0.0"');
  });

  test("fails on a missing engines.bun", () => {
    const r = run("check-bun-policy.ts", tree([], base(undefined)));
    expect(r.code).toBe(1);
    expect(r.out).toContain("engines.bun nowhere");
  });

  test("fails when a publishing workflow uses latest", () => {
    const root = tree(
      [],
      base(">=1.4.2", {
        ".github/workflows/release.yml": "        with:\n          bun-version: latest\n",
      }),
    );
    const r = run("check-bun-policy.ts", root);
    expect(r.code).toBe(1);
    expect(r.out).toContain("::error file=.github/workflows/release.yml::");
  });

  test("fails on a numeric pin or container tag that disagrees", () => {
    const root = tree(
      [],
      base(">=1.4.2", {
        ".github/workflows/ci.yml": "          bun-version: 1.3.0\n    container: oven/bun:1.3.0\n",
      }),
    );
    const r = run("check-bun-policy.ts", root);
    expect(r.code).toBe(1);
    expect(r.out).toContain("pins Bun 1.3.0");
    expect(r.out).toContain("oven/bun:1.3.0");
  });
});

describe("check-skills", () => {
  test("passes on the real repository", () => {
    expect(run("check-skills.ts").code).toBe(0);
  });

  test("fails when a vendored skill is edited without re-pinning", () => {
    const root = tree([".agents/skills/karpathy-guidelines", "skills-lock.json"]);
    const skill = join(root, ".agents/skills/karpathy-guidelines/SKILL.md");
    writeFileSync(skill, readFileSync(skill, "utf8") + "\nOne more rule.\n");
    const r = run("check-skills.ts", root);
    expect(r.code).toBe(1);
    expect(r.out).toContain("karpathy-guidelines hashes to");
  });

  test("passes with the vendored copy untouched", () => {
    const root = tree([".agents/skills/karpathy-guidelines"], {
      "skills-lock.json": json({
        version: 1,
        skills: {
          "karpathy-guidelines": JSON.parse(real("skills-lock.json")).skills["karpathy-guidelines"],
        },
      }),
    });
    expect(run("check-skills.ts", root).code).toBe(0);
  });
});

describe("check-links", () => {
  /** A temp git work tree: links resolve against what git sees, not the disk. */
  function repoTree(files: Record<string, string>): string {
    const root = tree([], files);
    Bun.spawnSync(["git", "init", "-q"], { cwd: root });
    return root;
  }

  test("passes on the real repository", () => {
    expect(run("check-links.ts").code).toBe(0);
  });

  test("passes when every relative link resolves", () => {
    const root = repoTree({
      "README.md":
        "[a](docs/a.md#part) [dir](docs/) ![img](docs/i.png) [web](https://x.y) [here](#top)\n",
      "docs/a.md": "[back](../README.md)\n",
      "docs/i.png": "",
    });
    expect(run("check-links.ts", root).code).toBe(0);
  });

  test("fails on a link to a moved file, naming the line", () => {
    const root = repoTree({ "editors/x/README.md": "intro\n\nsee [`templates/`](templates/)\n" });
    const r = run("check-links.ts", root);
    expect(r.code).toBe(1);
    expect(r.out).toContain("::error file=editors/x/README.md,line=3::");
  });

  test("fails on a link into a gitignored directory", () => {
    const root = repoTree({
      ".gitignore": "private/\n",
      "private/plan.md": "x\n",
      "README.md": "[plan](private/plan.md)\n",
    });
    expect(run("check-links.ts", root).code).toBe(1);
  });

  test("ignores links inside code, and skips specs, plans and reviews", () => {
    const root = repoTree({
      "README.md": "`[a](missing.md)`\n\n```md\n[b](missing.md)\n```\n",
      "docs/design/x-spec.md": "[gone](gone.md)\n",
      "docs/reviews/2026-01-01.md": "[gone](gone.md)\n",
    });
    expect(run("check-links.ts", root).code).toBe(0);
  });
});
