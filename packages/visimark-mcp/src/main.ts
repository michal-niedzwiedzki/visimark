import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { pathToFileURL } from "node:url";
import { parseArgs } from "./args.js";
import { createServer } from "./server.js";

/**
 * The entry point. Returns the process exit code rather than calling
 * `process.exit` itself, so a test can drive it in-process.
 *
 * Exit codes are the server's own, never a document's: `0` on clean shutdown,
 * `2` on a usage error in its own arguments, and **never** `1` because a
 * document had findings — that is a successful tool call (spec §3.1).
 *
 * Arguments are refused **before the transport starts**, as the CLI does
 * (#121). Once stdio is the protocol stream there is nowhere left to print a
 * usage line: anything on stdout corrupts it.
 */
export async function runServer(argv: readonly string[]): Promise<number> {
  const parsed = parseArgs(argv);
  if ("usage" in parsed) {
    console.error(parsed.usage);
    return 2;
  }

  const { connect } = createServer({ allowWrite: parsed.args.allowWrite });
  const transport = new StdioServerTransport();
  await connect(transport);

  // Resolve when the transport closes, so the process lives as long as the
  // conversation and exits 0 when the host hangs up.
  await new Promise<void>((resolve) => {
    transport.onclose = resolve;
  });
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
