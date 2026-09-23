import type { Fault } from "../errors.js";

/**
 * A tool, stated independently of the MCP SDK so that every behaviour in the
 * spec's §4 table can be asserted without a transport. Task 7 wraps these for
 * the server; nothing here imports the SDK.
 */
export interface ToolAnnotations {
  readonly readOnlyHint: boolean;
  readonly destructiveHint: boolean;
}

/** Success carries an envelope; a fault becomes an MCP tool error (§3.1). */
export type Outcome = { readonly ok: object } | { readonly fault: Fault };

export interface ToolDef {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly annotations: ToolAnnotations;
  run(args: unknown): Outcome;
}

/** `readOnlyHint: true, destructiveHint: false` — the six read tools. */
export const READ_ONLY: ToolAnnotations = { readOnlyHint: true, destructiveHint: false };

/**
 * The apply tools, in **both** gate states. The annotation describes the tool,
 * not the session: hosts gate on these, and a server that lies about them is
 * untrustworthy in precisely the community this is meant to reach (§2.4).
 */
export const DESTRUCTIVE: ToolAnnotations = { readOnlyHint: false, destructiveHint: true };

/** `path` or `content`, the §2.3 pair, as JSON Schema. */
export function docInputSchema(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to a Markdown document on disk." },
      content: {
        type: "string",
        description:
          "The document as text, for a draft that is not on disk. Give this or `path`, never both.",
      },
      ...extra,
    },
    additionalProperties: false,
  };
}
