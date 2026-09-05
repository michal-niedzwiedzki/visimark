import { pathToFileURL } from "node:url";
import { cmdCheck, cmdEval, cmdExplain, cmdFmt, cmdInfer, type Writer } from "./commands.js";

const USAGE = `visimark — spreadsheet mechanics for Markdown

usage:
  visimark check FILE... [--require-formulas]
                                        read-only; exit 1 if any finding.
                                        A document with no \`vmark\` rules gets
                                        an advisory \`try visimark infer\` line
                                        and still exits 0; --require-formulas
                                        makes that case a finding.
  visimark fmt   FILE... [--fix-dates] rewrite computed cells and anchors
  visimark infer FILE... [--write]     propose rules for a document with none
  visimark eval  FILE [--get NAME] [--json]
  visimark explain FILE [#sheet]       print rules and dependency order

exit codes: 0 clean, 1 findings, 2 usage or read failure`;

export interface CliIO {
  out?: Writer;
  err?: Writer;
}

export async function runCli(argv: string[], io: CliIO = {}): Promise<number> {
  const out = io.out ?? ((l: string) => process.stdout.write(l + "\n"));
  const err = io.err ?? ((l: string) => process.stderr.write(l + "\n"));

  const [command, ...rest] = argv;
  switch (command) {
    case "check":
      return cmdCheck(rest, out, err);
    case "fmt":
      return cmdFmt(rest, out, err);
    case "infer":
      return cmdInfer(rest, out, err);
    case "eval":
      return cmdEval(rest, out, err);
    case "explain":
      return cmdExplain(rest, out, err);
    case "-h":
    case "--help":
    case "help":
      out(USAGE);
      return 0;
    default:
      err(command ? `visimark: unknown command \`${command}\`` : "visimark: no command given");
      err(USAGE);
      return 2;
  }
}

// Run when invoked directly (`bun src/cli/main.ts check FILE`). `import.meta.main`
// would be the obvious test, but bun's bundler rewrites it to a CommonJS check
// that is always true in the ESM bundle, so dist/cli/main.js would run itself on
// import as well. Comparing against argv[1] survives bundling: when bin/visimark.js
// is the entry point this is false and that shim calls runCli itself.
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  runCli(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.error(err instanceof Error ? err.stack : String(err));
      process.exit(2);
    },
  );
}
