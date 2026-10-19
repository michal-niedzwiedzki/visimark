/**
 * Fails when a type package resolves newer than the runtime floor it stands
 * in for.
 *
 * A type package's version is an API claim. Compile against `@types/vscode`
 * 1.138 with `engines.vscode` at `^1.91.0` and code may call an API 1.91 does
 * not have, and the typecheck still passes. A caret in package.json lets the
 * lockfile drift past the floor on any re-resolve, and Dependabot's ignore
 * list only stops it editing the manifest — so this reads what `bun.lock`
 * actually locked. Review 2026-10-15 §2.5.
 *
 * | Locked package | Must not exceed |
 * |---|---|
 * | `@types/node` (major) | `engines.node` in `packages/visimark/package.json`, which `ci.yml`'s `node-support-policy` holds at the current LTS |
 * | `@types/vscode` | `engines.vscode` in `editors/vscode/package.json` |
 *
 * When the floor moves, the type package moves in the same commit.
 *
 * `obsidian` is deliberately not here. Its typings carry `@since` tags, so the
 * plugin compiles against the latest and `editors/obsidian/test/since-drift.test.ts`
 * fails any API it uses that is newer than `minAppVersion` — a check that
 * needs the newer typings to read the tags from.
 *
 * Usage: `bun scripts/check-type-floors.ts [root]` — `root` defaults to the
 * repository root and exists so the check can run against a temp tree.
 * Exit 0 clean, 1 findings, 2 usage. Annotations go to stdout.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
if (args.length > 1) {
  console.error("usage: check-type-floors [root]");
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

function json(file: string): Record<string, unknown> | null {
  const text = read(file);
  if (text === null) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * The version `bun.lock` resolved for a top-level package. bun.lock allows
 * trailing commas, so it is not parsed as JSON; the hoisted entry is the line
 * at four spaces of indent whose key is exactly the name. A nested copy
 * (`"some-dep/@types/node"`) belongs to that dependency and is not checked.
 */
function locked(lock: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const m = new RegExp(`^ {4}"${escaped}": \\["${escaped}@([^"]+)"`, "m").exec(lock);
  return m?.[1] ?? null;
}

const LOCK = "bun.lock";
const ENGINE = "packages/visimark/package.json";
const VSCODE = "editors/vscode/package.json";

const lock = read(LOCK);
if (lock === null) {
  annotate(LOCK, `cannot read ${LOCK}.`);
  process.exit(1);
}

let fail = false;
function check(
  pkg: string,
  floorFile: string,
  floor: string | null,
  compare: (got: string, floor: string) => boolean,
): void {
  const got = locked(lock!, pkg);
  if (got === null || floor === null) {
    annotate(
      got === null ? LOCK : floorFile,
      `cannot read ${got === null ? `${pkg} in ${LOCK}` : `the floor in ${floorFile}`}. Fix scripts/check-type-floors.ts if the layout moved.`,
    );
    fail = true;
    return;
  }
  if (!compare(got, floor)) {
    annotate(
      LOCK,
      `${LOCK} locks ${pkg}@${got}, newer than the runtime floor ${floor} in ${floorFile}. Pin ${pkg} at the floor: types newer than the runtime let code call APIs the floor does not have.`,
    );
    fail = true;
    return;
  }
  console.log(`${pkg}@${got} — floor ${floor} (${floorFile})`);
}

const notAbove = (got: string, floor: string): boolean => Bun.semver.order(got, floor) <= 0;
const major = (v: string): number => Number(v.split(".")[0]);

const engines = json(ENGINE)?.engines as Record<string, string> | undefined;
const nodeFloor = /^>=(\d+)/.exec(engines?.node ?? "")?.[1] ?? null;
check("@types/node", ENGINE, nodeFloor, (got, floor) => major(got) <= Number(floor));

const vscodeEngines = json(VSCODE)?.engines as Record<string, string> | undefined;
const vscodeFloor = /^\^?(\d+\.\d+\.\d+)$/.exec(vscodeEngines?.vscode ?? "")?.[1] ?? null;
check("@types/vscode", VSCODE, vscodeFloor, notAbove);

process.exit(fail ? 1 : 0);
