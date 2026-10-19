/**
 * The server's own argument surface: `visimark-mcp [--allow-write]
 * [--max-questions N]` and nothing else (spec §2.1). An unrecognised option is
 * refused with exit `2` before the transport starts, as the CLI does (#121) — a
 * server that has already opened stdio cannot report a usage error without
 * corrupting the protocol stream.
 */
export interface ServerArgs {
  readonly allowWrite: boolean;
  /** the most questions `visimark_simulate` will run; absent means no cap */
  readonly maxQuestions?: number;
}

export type ArgsResult =
  | { readonly args: ServerArgs }
  | { readonly usage: string }
  | { readonly help: string };

const HELP = `usage: visimark-mcp [--allow-write] [--max-questions N]

Runs the VisiMark MCP server on stdio.

  --allow-write      open the flag half of the write gate
  --max-questions N  refuse a visimark_simulate call whose grid has more than N
                     questions (a positive integer; unset means no limit)
  -h, --help         print this help and exit 0`;

export function parseArgs(argv: readonly string[]): ArgsResult {
  let allowWrite = false;
  let maxQuestions: number | undefined;
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (token === "--help" || token === "-h") return { help: HELP };
    if (token === "--allow-write") allowWrite = true;
    else if (token === "--max-questions") {
      const value = argv[++i];
      if (
        value === undefined ||
        !/^[1-9][0-9]*$/.test(value) ||
        !Number.isSafeInteger(Number(value))
      ) {
        return {
          usage: `visimark-mcp: --max-questions needs a positive integer, got ${value ?? "nothing"}`,
        };
      }
      maxQuestions = Number(value);
    } else return { usage: `visimark-mcp: unknown option ${token}` };
  }
  return { args: { allowWrite, ...(maxQuestions === undefined ? {} : { maxQuestions }) } };
}
