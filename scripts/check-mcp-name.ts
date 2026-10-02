/**
 * Fails when `visimark-mcp`'s `mcpName` disagrees with `server.json`'s `name`.
 *
 * The MCP registry refuses a publish whose npm package does not name the entry
 * it belongs to. v0.1.9 was refused for exactly that, and npm versions are
 * immutable, so the fix cost a whole release across four packages. `ci.yml`
 * runs this so the mismatch is a red PR, not a red tag.
 *
 * Usage: `bun scripts/check-mcp-name.ts [root]` — `root` defaults to the
 * repository root and exists so the check can run against a temp tree.
 * Exit 0 clean, 1 findings, 2 usage. Annotations go to stdout.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
if (args.length > 1) {
  console.error("usage: check-mcp-name [root]");
  process.exit(2);
}
const root = resolve(args[0] ?? join(dirname(fileURLToPath(import.meta.url)), ".."));

const PACKAGE = "packages/visimark-mcp/package.json";
const SERVER = "server.json";
const annotate = (file: string, message: string): void =>
  console.log(`::error file=${file}::${message}`);

function field(file: string, key: string): string | null {
  try {
    const value: unknown = JSON.parse(readFileSync(join(root, file), "utf8"))[key];
    return typeof value === "string" && value !== "" ? value : null;
  } catch {
    return null;
  }
}

const mcpName = field(PACKAGE, "mcpName");
const name = field(SERVER, "name");
if (mcpName === null) {
  annotate(PACKAGE, `${PACKAGE} has no "mcpName". The MCP registry refuses a package without it.`);
}
if (name === null) {
  annotate(
    SERVER,
    `cannot read "name" in ${SERVER}. Fix scripts/check-mcp-name.ts if the layout moved.`,
  );
}
if (mcpName === null || name === null) process.exit(1);
if (mcpName !== name) {
  annotate(
    PACKAGE,
    `${PACKAGE} says mcpName "${mcpName}" but ${SERVER} says name "${name}". The MCP registry validates one against the other — see docs/releasing.md.`,
  );
  process.exit(1);
}
console.log(`mcp name: ${name}`);
