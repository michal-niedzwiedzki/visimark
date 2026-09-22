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

export type ArgsResult = { readonly args: ServerArgs } | { readonly usage: string };

export function parseArgs(argv: readonly string[]): ArgsResult {
  let allowWrite = false;
  for (const token of argv) {
    if (token === "--allow-write") allowWrite = true;
    else return { usage: `visimark-mcp: unknown option ${token}` };
  }
  return { args: { allowWrite } };
}
