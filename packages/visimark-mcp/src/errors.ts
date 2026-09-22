/**
 * The `2` class, which is the only class that becomes an MCP tool error
 * (spec §3.1). `0` is a successful call with `status: "ok"` and `1` is a
 * successful call with `status: "problems"` — a document with findings is not
 * a broken server.
 *
 * `USAGE`, `READ` and `SCENARIO` are the engine's own codes, carried through
 * unchanged. `WRITE` is this package's, for the gate in §2.4: it has no CLI
 * counterpart because the CLI has no gate.
 */
export type FaultCode = "USAGE" | "READ" | "SCENARIO" | "WRITE";

export interface Fault {
  readonly code: FaultCode;
  readonly message: string;
}

export function fault(code: FaultCode, message: string): Fault {
  return { code, message };
}

export function isFault(v: unknown): v is Fault {
  return typeof v === "object" && v !== null && "code" in v && "message" in v;
}
