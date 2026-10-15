/**
 * Fails when a version-carrying file disagrees with the engine's version.
 *
 * One tag publishes every package, so a manifest left behind ships under the
 * wrong number or fails a leg midway with the others already out. The files:
 *
 * - every manifest in `scripts/release-manifests.ts`: its own `version`, and
 *   its exact `dependencies.visimark` pin where it has one;
 * - `bun.lock`'s mirror of each of those in its `workspaces` block. Bun links
 *   a workspace-named dependency locally whatever the pin text says, so
 *   `--frozen-lockfile` never refuses over this — it sat at 0.1.8 through two
 *   releases before anyone noticed;
 * - `action.yml`'s `version` default and the pre-commit hook's `pinned=`
 *   line, which are what a tag-pinned consumer actually runs;
 * - `server.json`'s two `version` fields, which the MCP registry reads.
 *
 * `bun scripts/prepare-release.ts` bumps all of them; docs/releasing.md says
 * when. Usage: `bun scripts/check-versions.ts [root]` — `root` defaults to the
 * repository root and exists so the check can run against a temp tree.
 * Exit 0 clean, 1 findings, 2 usage. Annotations go to stdout.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACTION_VERSION,
  ENGINE_MANIFEST,
  HOOK_PIN,
  RELEASE_MANIFESTS,
  lockBlock,
  workspaceOf,
} from "./release-manifests.ts";

const args = process.argv.slice(2);
if (args.length > 1) {
  console.error("usage: check-versions [root]");
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
function json(file: string): Record<string, any> | null {
  const text = read(file);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

let fail = false;
const moved = (file: string, what: string): void => {
  annotate(
    file,
    `cannot read ${what} in ${file}. Fix scripts/check-versions.ts if the layout moved.`,
  );
  fail = true;
};

const engine: unknown = json(ENGINE_MANIFEST)?.version;
if (typeof engine !== "string") {
  moved(ENGINE_MANIFEST, '"version"');
  process.exit(1);
}

const seen: string[] = [];
function expectEngine(file: string, what: string, got: unknown): void {
  if (typeof got !== "string" || got === "") return moved(file, what);
  seen.push(`${file} ${what}=${got}`);
  if (got !== engine) {
    annotate(
      file,
      `${file} ${what} says ${got} but ${ENGINE_MANIFEST} says ${engine}. Bump every version-carrying file in the release commit — run bun scripts/prepare-release.ts, see docs/releasing.md.`,
    );
    fail = true;
  }
}

const lock = read("bun.lock");
for (const { file, pinsEngine } of RELEASE_MANIFESTS) {
  const m = json(file);
  expectEngine(file, '"version"', m?.version);
  if (pinsEngine) expectEngine(file, "dependencies.visimark", m?.dependencies?.visimark);

  const workspace = workspaceOf(file);
  const block = lock === null ? null : lockBlock(lock, workspace);
  if (block === null) {
    moved("bun.lock", `the "${workspace}" workspace block`);
    continue;
  }
  expectEngine("bun.lock", `${workspace} "version"`, /"version": "([^"]*)"/.exec(block)?.[1]);
  if (pinsEngine) {
    expectEngine("bun.lock", `${workspace} "visimark"`, /"visimark": "([^"]*)"/.exec(block)?.[1]);
  }
}

expectEngine(
  "action.yml",
  "the version input's default",
  ACTION_VERSION.exec(read("action.yml") ?? "")?.[2],
);

const hook = "scripts/precommit-visimark-check.sh";
const pins = [...(read(hook) ?? "").matchAll(HOOK_PIN)].map((m) => m[1]);
if (pins.length !== 1) {
  annotate(hook, `${hook}: expected exactly one pinned=<version> line, found ${pins.length}.`);
  fail = true;
} else expectEngine(hook, "pinned", pins[0]);

const server = json("server.json");
expectEngine("server.json", '"version"', server?.version);
for (const [i, pkg] of ((server?.packages ?? []) as Array<Record<string, unknown>>).entries()) {
  expectEngine("server.json", `packages[${i}].version`, pkg.version);
}

for (const line of seen) console.log(line);
process.exit(fail ? 1 : 0);
