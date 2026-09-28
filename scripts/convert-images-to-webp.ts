/**
 * Converts PNG/JPEG images under docs/ to .webp, deletes the original, and
 * rewrites every tracked file that names it.
 *
 * Uses the `cwebp` binary (from libwebp) rather than Bun's native
 * `Image.webp()` — this script runs occasionally by hand, not on every
 * install, so a machine needing `cwebp` on PATH is an acceptable one-time
 * setup cost for output that matches the encoder people actually tune
 * against.
 *
 * EXCLUDE below is for a file that's a build output another script
 * regenerates as PNG (docs/og-card.png, from scripts/gen-og-image.mjs) —
 * converting it would just come back as a .png the next time that
 * generator runs.
 *
 * Usage: `bun run images:webp [--dry-run] [--quality=N] [--force]`
 *
 * A tracked original (staged or committed) is replaced in git: `git rm` the
 * old path, `git add` the new .webp and every file whose reference text
 * changed. An untracked original is just deleted from disk — nothing is
 * staged for it.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIR = join(ROOT, "docs");

const EXCLUDE = new Set<string>([
  // Regenerated as PNG by scripts/gen-og-image.mjs; see docs comment above.
  "docs/og-card.png",
]);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const qualityArg = args.find((a) => a.startsWith("--quality="));
const quality = qualityArg ? Number(qualityArg.slice("--quality=".length)) : 82;

function git(argv: string[]): string {
  return execFileSync("git", argv, { cwd: ROOT, encoding: "utf8" });
}

function isTracked(relPath: string): boolean {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", relPath], {
      cwd: ROOT,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

/** Tracked, non-binary files (other than the image itself) that name `basename`. */
function referencingFiles(basename: string, ownRelPath: string): string[] {
  let out: string;
  try {
    out = git([
      "grep",
      "--ignore-case",
      "--files-with-matches",
      "--fixed-strings",
      "-I",
      "--",
      basename,
    ]);
  } catch {
    return []; // git grep exits 1 when nothing matches
  }
  return out
    .split("\n")
    .filter(Boolean)
    .filter((p) => p !== ownRelPath);
}

async function findImages(): Promise<string[]> {
  const glob = new Bun.Glob("**/*.{png,jpg,jpeg,PNG,JPG,JPEG}");
  const results: string[] = [];
  for await (const relToScanDir of glob.scan({ cwd: SCAN_DIR })) {
    results.push(relative(ROOT, join(SCAN_DIR, relToScanDir)));
  }
  return results.sort();
}

function convert(absPath: string, webpAbsPath: string, quality: number): void {
  execFileSync("cwebp", ["-quiet", "-q", String(quality), absPath, "-o", webpAbsPath]);
}

async function main() {
  try {
    execFileSync("cwebp", ["-version"], { stdio: "pipe" });
  } catch {
    console.error("cwebp not found on PATH — install libwebp (e.g. `apt install webp`).");
    process.exit(1);
  }

  const images = await findImages();
  let converted = 0;
  let skippedExcluded = 0;

  for (const relPath of images) {
    if (EXCLUDE.has(relPath)) {
      console.log(`skip (excluded): ${relPath}`);
      skippedExcluded++;
      continue;
    }

    const absPath = join(ROOT, relPath);
    const webpRelPath = relPath.replace(/\.(png|jpg|jpeg)$/i, ".webp");
    const webpAbsPath = join(ROOT, webpRelPath);
    const basename = relPath.split("/").pop()!;
    const webpBasename = webpRelPath.split("/").pop()!;

    const refs = referencingFiles(basename, relPath);

    if (existsSync(webpAbsPath) && !force) {
      console.warn(`skip (target exists, pass --force to overwrite): ${webpRelPath}`);
      continue;
    }

    if (dryRun) {
      console.log(
        `would convert: ${relPath} -> ${webpRelPath}` +
          (refs.length > 0 ? ` (updating ${refs.length} reference(s))` : ""),
      );
      converted++;
      continue;
    }

    convert(absPath, webpAbsPath, quality);

    for (const refRelPath of refs) {
      const refAbsPath = join(ROOT, refRelPath);
      const text = readFileSync(refAbsPath, "utf8");
      const updated = text.split(basename).join(webpBasename);
      if (updated !== text) writeFileSync(refAbsPath, updated);
    }

    const tracked = isTracked(relPath);
    if (tracked) {
      git(["rm", "-f", "--", relPath]);
      git(["add", "--", webpRelPath, ...refs]);
    } else {
      rmSync(absPath);
    }

    console.log(
      `converted: ${relPath} -> ${webpRelPath}` +
        (refs.length > 0 ? ` (updated ${refs.length} reference(s))` : "") +
        (tracked ? " [staged in git]" : ""),
    );
    converted++;
  }

  console.log(
    `\n${converted} converted, ${skippedExcluded} skipped (excluded)${dryRun ? " [dry run]" : ""}`,
  );
}

main();
