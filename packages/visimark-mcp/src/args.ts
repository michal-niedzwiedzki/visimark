/**
 * The server's own argument surface: `visimark-mcp [--allow-write]` and
 * nothing else (spec §2.1). An unrecognised option is refused with exit `2`
 * before the transport starts, as the CLI does (#121) — a server that has
 * already opened stdio cannot report a usage error without corrupting the
 * protocol stream.
 */
export interface ServerArgs {
  readonly allowWrite: boolean;
}

export type ArgsResult =
  | { readonly args: ServerArgs }
  | { readonly usage: string }
  | { readonly help: string };

const HELP = `usage: visimark-mcp [--allow-write]

Runs the VisiMark MCP server on stdio.

  --allow-write   open the flag half of the write gate
  -h, --help      print this help and exit 0`;

export function parseArgs(argv: readonly string[]): ArgsResult {
  let allowWrite = false;
  for (const token of argv) {
    if (token === "--help" || token === "-h") return { help: HELP };
    if (token === "--allow-write") allowWrite = true;
    else return { usage: `visimark-mcp: unknown option ${token}` };
  }
  return { args: { allowWrite } };
}
