/**
 * Fails when Bun's version is stated somewhere that disagrees with the one
 * pin, `packageManager` in the root package.json.
 *
 * Node has an enforced policy (`ci.yml`'s `node-support-policy`); Bun had
 * three answers that disagreed: `packageManager` for local work, `latest` for
 * the builds that publish, and `engines.bun: ">=1.0.0"` — a floor no job ran.
 * Review 2026-10-15 §2.7. The policy, checked here:
 *
 * - every package that publishes to npm declares `engines.bun` as
 *   `>=<packageManager version>`: the floor is the Bun CI builds and tests
 *   with, not one nothing exercises;
 * - the workflows that publish (`release.yml`, `obsidian-release.yml`) read
 *   that version with `bun-version-file: package.json`, so what ships is built
 *   by the Bun developers use, not whatever was `latest` that hour;
 * - a numeric `bun-version:` or `oven/bun:` tag anywhere else names the same
 *   version. `latest` stays allowed: `ci.yml`'s `build` job keeps it as the
 *   canary for the next Bun.
 *
 * Bumping Bun is one commit: `packageManager`, every `engines.bun`, and any
 * numeric pin this lists.
 *
 * Usage: `bun scripts/check-bun-policy.ts [root]` — `root` defaults to the
 * repository root and exists so the check can run against a temp tree.
 * Exit 0 clean, 1 findings, 2 usage. Annotations go to stdout.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NPM_MANIFESTS } from "./release-manifests.ts";

const args = process.argv.slice(2);
if (args.length > 1) {
  console.error("usage: check-bun-policy [root]");
  process.exit(2);
}
const root = resolve(args[0] ?? join(dirname(fileURLToPath(import.meta.url)), ".."));
const annotate = (file: string, message: string): void =>
  console.log(`::error file=${file}::${message}`);

function read(file: string): string | null {
  try {
    return readFileSync(join(root, file), "utf8");
  } catch {
    return null;
  }
}

let fail = false;
const pm = /^bun@(\d+\.\d+\.\d+)$/.exec(
  (JSON.parse(read("package.json") ?? "{}") as { packageManager?: string }).packageManager ?? "",
)?.[1];
if (pm === undefined) {
  annotate("package.json", 'package.json has no "packageManager": "bun@X.Y.Z".');
  process.exit(1);
}

const floor = `>=${pm}`;
for (const { file } of NPM_MANIFESTS) {
  const text = read(file);
  const declared = text === null ? undefined : JSON.parse(text)?.engines?.bun;
  if (declared !== floor) {
    annotate(
      file,
      `${file} declares engines.bun ${declared === undefined ? "nowhere" : `"${declared}"`}; it must be "${floor}", the packageManager Bun that CI builds and tests with.`,
    );
    fail = true;
  }
}

const WORKFLOWS = ".github/workflows";
const PUBLISHING = new Set(["release.yml", "obsidian-release.yml"]);
const workflows = existsSync(join(root, WORKFLOWS))
  ? readdirSync(join(root, WORKFLOWS))
      .filter((f) => /\.ya?ml$/.test(f))
      .sort()
  : [];
for (const name of workflows) {
  const file = `${WORKFLOWS}/${name}`;
  const lines = (read(file) ?? "").split("\n");
  lines.forEach((line, i) => {
    const pin = /^\s*bun-version:\s*"?([^"\s#]+)"?/.exec(line)?.[1];
    const image = /^\s*container:\s*"?oven\/bun:([^"\s#]+)"?/.exec(line)?.[1];
    const where = `${file}:${i + 1}`;
    if (pin !== undefined && PUBLISHING.has(name)) {
      annotate(
        file,
        `${where} sets bun-version: ${pin}. A publishing workflow builds with the pinned Bun: use bun-version-file: package.json.`,
      );
      fail = true;
    } else if (pin !== undefined && pin !== "latest" && pin !== pm) {
      annotate(
        file,
        `${where} pins Bun ${pin}, but packageManager says ${pm}. Use bun-version-file: package.json, or latest for a canary.`,
      );
      fail = true;
    }
    if (image !== undefined && image !== "latest" && image !== pm) {
      annotate(file, `${where} runs oven/bun:${image}, but packageManager says ${pm}.`);
      fail = true;
    }
  });
  if (
    PUBLISHING.has(name) &&
    !lines.some((l) => /^\s*bun-version-file:\s*"?package\.json"?\s*$/.test(l))
  ) {
    annotate(
      file,
      `${file} never sets bun-version-file: package.json; the Bun it publishes with is unpinned.`,
    );
    fail = true;
  }
}

if (!fail)
  console.log(
    `bun ${pm}: engines.bun ${floor} on ${NPM_MANIFESTS.length} packages; workflows agree`,
  );
process.exit(fail ? 1 : 0);
