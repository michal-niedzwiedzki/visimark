/**
 * Parses the tail of a `vmark` fence info string: the sheet id, and — for a
 * **declared input** — the `from <path> [delimited <char>] [labelled
 * <col>,...] [at sha256:<digest>]` clause. See visimark-design.md §3 and
 * `docs/design/declared-local-data-imports-spec.md` §2.
 *
 * Offsets returned here are relative to the start of `meta` itself; the
 * caller (`document.ts`) rebases them to absolute source offsets, exactly as
 * it already rebases expression spans parsed out of a block body.
 */

export interface RelSpan {
  start: number;
  end: number;
}

export interface ImportDeclRel {
  path: string;
  pathSpan: RelSpan;
  delimiter: string;
  labels: string[] | null;
  labelsSpan: RelSpan | null;
  stampPrefix: string | null;
  stampDigest: string | null;
  stampSpan: RelSpan | null;
  declSpan: RelSpan;
}

export interface FenceInfoResult {
  sheetId: string | null;
  importDecl: ImportDeclRel | null;
  grammarError: { message: string; span: RelSpan } | null;
}

const WORD_RE = /^(\S+)/;
/** a delimiter character may not be drawn from a field's own alphabet, or a
 *  quote, or the characters number literals use — see spec §2. */
const BAD_DELIMITER_CHAR = /[A-Za-z0-9".\-\s]/;

export function parseFenceInfo(meta: string | null): FenceInfoResult {
  if (!meta) return { sheetId: null, importDecl: null, grammarError: null };

  const idMatch = /^#(\S+)/.exec(meta.trim());
  if (!idMatch) return { sheetId: null, importDecl: null, grammarError: null };
  const sheetId = idMatch[1]!;

  // position right after the `#id` token, in `meta`'s own (untrimmed) indexing
  const leadingWs = meta.length - meta.trimStart().length;
  const idEnd = leadingWs + idMatch[0].length;
  const tail = meta.slice(idEnd);

  // Only a tail that actually opens with `from` is treated as an import
  // declaration — anything else is left exactly as before (silently ignored),
  // which matches today's behaviour for every non-`from` sheet.
  const fromMatch = /^\s*from\b/.exec(tail);
  if (!fromMatch) return { sheetId, importDecl: null, grammarError: null };

  const declStart = idEnd;
  let pos = idEnd + fromMatch[0].length;

  const err = (message: string, start: number, end: number) => ({
    sheetId,
    importDecl: null,
    grammarError: { message, span: { start, end } },
  });

  const skipWs = (): void => {
    while (pos < meta.length && /\s/.test(meta[pos]!)) pos++;
  };
  const nextWord = (): { text: string; start: number; end: number } | null => {
    skipWs();
    const m = WORD_RE.exec(meta.slice(pos));
    if (!m) return null;
    const start = pos;
    return { text: m[1]!, start, end: start + m[1]!.length };
  };

  skipWs();
  const pathTok = nextWord();
  if (!pathTok) return err("`from` needs a path", declStart, pos);
  pos = pathTok.end;
  const pathSpan: RelSpan = { start: pathTok.start, end: pathTok.end };

  let delimiter = ",";
  let labels: string[] | null = null;
  let labelsSpan: RelSpan | null = null;
  let stampPrefix: string | null = null;
  let stampDigest: string | null = null;
  let stampSpan: RelSpan | null = null;

  // clause order is fixed: delimited, then labelled, then at
  let stage: 0 | 1 | 2 | 3 = 0;

  for (;;) {
    skipWs();
    if (pos >= meta.length) break;
    const word = nextWord()!;

    if (word.text === "delimited") {
      if (stage >= 1) return err("`delimited` is out of order or repeated", word.start, word.end);
      stage = 1;
      pos = word.end;
      const charTok = nextWord();
      if (!charTok) return err("`delimited` needs a character", word.start, pos);
      pos = charTok.end;
      if (charTok.text.length !== 1) {
        return err(
          "`delimited` takes exactly one character, got `" + charTok.text + "`",
          charTok.start,
          charTok.end,
        );
      }
      if (BAD_DELIMITER_CHAR.test(charTok.text)) {
        return err(
          "`delimited " +
            charTok.text +
            "` is not allowed — a delimiter may not be a letter, digit, quote, `.`, `-`, or whitespace",
          charTok.start,
          charTok.end,
        );
      }
      delimiter = charTok.text;
      continue;
    }

    if (word.text === "labelled") {
      if (stage >= 2) return err("`labelled` is out of order or repeated", word.start, word.end);
      stage = 2;
      pos = word.end;
      // consume up to (but not including) a following bare `at` keyword, or EOF
      const rest = meta.slice(pos);
      const atBoundary = /\bat\b/.exec(rest);
      const listEnd = atBoundary ? pos + atBoundary.index : meta.length;
      const listText = meta.slice(pos, listEnd);
      const names = listText
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (names.length === 0) {
        return err("`labelled` needs at least one column name", word.start, listEnd);
      }
      labels = names;
      labelsSpan = { start: word.start, end: listEnd };
      pos = listEnd;
      continue;
    }

    if (word.text === "at") {
      if (stage >= 3) return err("`at` is out of order or repeated", word.start, word.end);
      stage = 3;
      pos = word.end;
      const tok = nextWord();
      if (!tok) return err("`at` needs a stamp", word.start, pos);
      pos = tok.end;
      const colon = tok.text.indexOf(":");
      if (colon === -1) {
        stampPrefix = tok.text;
        stampDigest = null;
      } else {
        stampPrefix = tok.text.slice(0, colon);
        stampDigest = tok.text.slice(colon + 1);
      }
      stampSpan = { start: word.start, end: tok.end };
      continue;
    }

    return err(
      "unrecognised token `" + word.text + "` in import declaration",
      word.start,
      word.end,
    );
  }

  const declSpan: RelSpan = { start: declStart, end: pos };
  return {
    sheetId,
    importDecl: {
      path: pathTok.text,
      pathSpan,
      delimiter,
      labels,
      labelsSpan,
      stampPrefix,
      stampDigest,
      stampSpan,
      declSpan,
    },
    grammarError: null,
  };
}
