import { closest } from "../report/levenshtein.js";
import type { CommandName } from "../report/json.js";

export interface Parsed {
  files: string[];
  flags: Set<string>;
  options: Map<string, string>;
  sheets: string[]; // #sheet arguments, without the '#'
}

export interface Refusal {
  ok: false;
  message: string; // the first stderr line, and error.message
  usage?: string; // a second stderr line, only for --help / -h
  json: boolean; // the exact token --json was present
}

const USAGE: Record<CommandName, string> = {
  check: "usage: visimark check FILE...",
  fmt: "usage: visimark fmt FILE... [--fix-dates]",
  infer: "usage: visimark infer FILE... [--write]",
  eval: "usage: visimark eval FILE [--scenario FILE|-] [--get NAME] [--json]",
  explain: "usage: visimark explain FILE [#sheet]",
  ref: "usage: visimark ref [NAME] [--json]",
};

export function usageLine(command: CommandName): string {
  return USAGE[command];
}

const ALL: readonly CommandName[] = ["check", "fmt", "infer", "eval", "explain", "ref"];

interface OptionSpec {
  commands: readonly CommandName[];
  value: boolean;
  needsValue?: string;
}

const OPTIONS: Record<string, OptionSpec> = {
  "--json": { commands: ALL, value: false },
  "--fix-dates": { commands: ["fmt"], value: false },
  "--write": { commands: ["infer"], value: false },
  "--get": { commands: ["eval"], value: true, needsValue: "visimark: --get needs a name" },
  "--scenario": {
    commands: ["eval"],
    value: true,
    needsValue: "visimark: --scenario needs a file, or - for stdin",
  },
};

function unknownOption(token: string, command: CommandName): string {
  if (token === "--") {
    return "visimark: unknown option -- — to name a file that starts with -, write ./-name";
  }
  const eq = token.indexOf("=");
  if (eq > 0) {
    const name = token.slice(0, eq);
    const spec = OPTIONS[name];
    if (spec?.commands.includes(command)) {
      const hint = spec.value
        ? `write \`${name} ${token.slice(eq + 1)}\``
        : `\`${name}\` takes no value`;
      return `visimark: unknown option ${token} — ${hint}`;
    }
  }
  const mine = Object.keys(OPTIONS).filter((o) => OPTIONS[o]!.commands.includes(command));
  const guess = token.startsWith("--") ? closest(token, mine, 3) : null;
  return `visimark: unknown option ${token}` + (guess ? ` — did you mean \`${guess}\`?` : "");
}

/**
 * Reads a command's arguments left to right and refuses the first one it does
 * not accept (docs/design/refuse-unrecognised-and-misplaced-cli-options-spec.md).
 * `OPTIONS[a]` cannot hit a prototype key: `a` always starts with `-`.
 */
export function parseArgs(
  command: CommandName,
  args: string[],
): { ok: true; parsed: Parsed } | Refusal {
  const json = args.includes("--json");
  const refuse = (message: string, usage = false): Refusal => ({
    ok: false,
    message,
    ...(usage ? { usage: USAGE[command] } : {}),
    json,
  });
  const files: string[] = [];
  const flags = new Set<string>();
  const options = new Map<string, string>();
  const sheets: string[] = [];
  const maxFiles = command === "eval" || command === "explain" || command === "ref" ? 1 : Infinity;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith("#")) {
      if (command !== "explain") return refuse(`visimark: ${a} is only valid with explain`);
      sheets.push(a.slice(1));
    } else if (a.startsWith("-") && a !== "-") {
      const spec = OPTIONS[a];
      if (!spec) return refuse(unknownOption(a, command), a === "--help" || a === "-h");
      if (!spec.commands.includes(command)) {
        return refuse(`visimark: ${a} is only valid with ${spec.commands[0]}`);
      }
      if (spec.value) {
        const v = args[i + 1];
        if (v === undefined || v === "" || v.startsWith("--")) return refuse(spec.needsValue!);
        options.set(a.slice(2), v);
        i++;
      } else {
        flags.add(a.slice(2));
      }
    } else {
      if (files.length >= maxFiles) {
        return refuse(
          command === "ref"
            ? "visimark: ref takes one name"
            : `visimark: ${command} takes one file`,
        );
      }
      files.push(a);
    }
  }
  return { ok: true, parsed: { files, flags, options, sheets } };
}
