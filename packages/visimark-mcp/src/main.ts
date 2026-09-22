import { pathToFileURL } from "node:url";
import { parseArgs } from "./args.js";

/**
 * The entry point. Returns the process exit code rather than calling
 * `process.exit` itself, so the handshake tests can drive it in-process.
 *
 * Exit codes are the server's own, never a document's: `0` on clean shutdown,
 * `2` on a usage error in these arguments. A document with findings is a
 * successful tool call (spec §3.1) and never reaches here.
 */
export async function runServer(argv: readonly string[]): Promise<number> {
  const parsed = parseArgs(argv);
  if ("usage" in parsed) {
    console.error(parsed.usage);
    return 2;
  }
  // Transport and tool registration arrive in task 7.
  return 0;
}

// Run when invoked directly (`bun src/main.ts --allow-write`). The reasoning is
// `packages/visimark/src/cli/main.ts`'s verbatim: `import.meta.main` is rewritten
// by bun's bundler to a check that is always true in the ESM bundle, so
// dist/main.js would run itself on import. Comparing against argv[1] survives
// bundling, and `bin/visimark-mcp.js` calls runServer itself.
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  runServer(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.error(err instanceof Error ? err.stack : String(err));
      process.exit(2);
    },
  );
}
