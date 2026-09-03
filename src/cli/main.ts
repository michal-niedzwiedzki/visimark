import {
  cmdCheck,
  cmdEval,
  cmdExplain,
  cmdFmt,
  type Writer,
} from "./commands.js";

const USAGE = `visimark — spreadsheet mechanics for Markdown

usage:
  visimark check FILE...               read-only; exit 1 if any finding
  visimark fmt   FILE... [--fix-dates] rewrite computed cells and anchors
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

// Run when invoked directly (`bun src/cli/main.ts check FILE`). When bundled
// into dist/ and imported by bin/visimark.js this is false, and that shim
// calls runCli itself.
if (import.meta.main) {
  runCli(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.error(err instanceof Error ? err.stack : String(err));
      process.exit(2);
    },
  );
}
