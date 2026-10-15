/**
 * Fails when a vendored skill under `.agents/skills/` differs from the hash
 * `skills-lock.json` records for it. A skill with no lock entry is written
 * here by hand and has no upstream to pin (`.agents/skills/README.md`).
 *
 * The lock says the third-party skills are "pinned by hash", and agents run
 * what those skills tell them to — two ship Python scripts. A pin nothing
 * verifies is a comment. Review 2026-10-15 §2.15.
 *
 * The hash is the one the `skills` CLI writes as `computedHash`: SHA-256 over
 * every file in the skill's folder (skipping `.git` and `node_modules`),
 * ordered by `localeCompare` of the `/`-separated relative path, feeding the
 * path and then the bytes of each.
 *
 * Updating a skill on purpose: re-run `npx skills add` (or `bunx skills add`)
 * for it, and commit the files and the lock together.
 *
 * Usage: `bun scripts/check-skills.ts [root]` — `root` defaults to the
 * repository root and exists so the check can run against a temp tree.
 * Exit 0 clean, 1 findings, 2 usage. Annotations go to stdout.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
if (args.length > 1) {
  console.error("usage: check-skills [root]");
  process.exit(2);
}
const root = resolve(args[0] ?? join(dirname(fileURLToPath(import.meta.url)), ".."));
const annotate = (file: string, message: string): void =>
  console.log(`::error file=${file}::${message}`);

const LOCK = "skills-lock.json";
const SKILLS = ".agents/skills";

function files(dir: string, base: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== ".git" && entry.name !== "node_modules") files(full, base, out);
    } else if (entry.isFile()) out.push(relative(base, full).split("\\").join("/"));
  }
  return out;
}

function skillHash(dir: string): string {
  const hash = createHash("sha256");
  for (const path of files(dir, dir).sort((a, b) => a.localeCompare(b))) {
    hash.update(path);
    hash.update(readFileSync(join(dir, path)));
  }
  return hash.digest("hex");
}

let lock: Record<string, { computedHash?: string }>;
try {
  lock = JSON.parse(readFileSync(join(root, LOCK), "utf8")).skills;
} catch {
  annotate(LOCK, `cannot read "skills" in ${LOCK}.`);
  process.exit(1);
}

let fail = false;
for (const [name, entry] of Object.entries(lock)) {
  const dir = join(root, SKILLS, name);
  if (!existsSync(dir)) {
    annotate(LOCK, `${LOCK} pins "${name}", but ${SKILLS}/${name} does not exist.`);
    fail = true;
    continue;
  }
  const got = skillHash(dir);
  if (got !== entry.computedHash) {
    annotate(
      `${SKILLS}/${name}/SKILL.md`,
      `${SKILLS}/${name} hashes to ${got}, but ${LOCK} records ${entry.computedHash}. A vendored skill changed without its pin: re-add it with the skills CLI, or revert the edit.`,
    );
    fail = true;
  } else console.log(`${name}: ${got}`);
}

process.exit(fail ? 1 : 0);
