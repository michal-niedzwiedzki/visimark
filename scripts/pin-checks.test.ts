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
