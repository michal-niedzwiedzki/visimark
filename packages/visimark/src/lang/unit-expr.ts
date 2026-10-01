/**
 * Unit expressions: the grammar written inside a unit bracket, and the algebra
 * over the maps it denotes. A unit map sends an opaque atom (`kg`, `PLN`,
 * `node`) to a non-zero integer exponent. Nothing here knows what an atom
 * means — `m` is not a metre and `kg` is not a thousand `g` — so two maps are
 * compatible exactly when they are equal after expanding the document's own
 * definitions. See docs/design/algebraic-unit-maps-on-names-spec.md §2.1, §3.
 *
 * Pure: no imports from `eval/`, `model/` or `report/`.
 */

/** atom → non-zero integer exponent; never holds a 0 */
export type UnitMap = ReadonlyMap<string, number>;

/** atom → the map it is defined as, at scale 1 (`[J] = [N⋅m]`) */
export type UnitDefs = ReadonlyMap<string, UnitMap>;

export const DIMENSIONLESS: UnitMap = new Map();

export type UnitParse = { ok: true; map: UnitMap } | { ok: false; message: string };

/** the only atoms with more than one spelling; each maps to its canonical form */
const SPELLINGS: ReadonlyMap<string, string> = new Map([
  ["degC", "℃"],
  ["°C", "℃"],
  ["℃", "℃"],
  ["degF", "℉"],
  ["°F", "℉"],
  ["℉", "℉"],
]);

const MUL = new Set(["⋅", "*", "·", "×"]);
const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const LETTER = /\p{L}/u;

type Tok =
  | { k: "atom"; text: string }
  | { k: "mul" }
  | { k: "div" }
  | { k: "pow"; n: number; text: string }
  | { k: "one" }
  | { k: "space" }
  | { k: "bad" };

function tokenize(src: string): Tok[] {
  const chars = [...src];
  const out: Tok[] = [];
  let i = 0;
  while (i < chars.length) {
    const c = chars[i]!;
    if (/\s/.test(c)) {
      while (i < chars.length && /\s/.test(chars[i]!)) i++;
      out.push({ k: "space" });
      continue;
    }
    if (MUL.has(c)) {
      out.push({ k: "mul" });
      i++;
      continue;
    }
    if (c === "/") {
      out.push({ k: "div" });
      i++;
      continue;
    }
    if (c === "℃" || c === "℉") {
      out.push({ k: "atom", text: c });
      i++;
      continue;
    }
    if (c === "°" || LETTER.test(c)) {
      let j = i + (c === "°" ? 1 : 0);
      const start = i;
      while (j < chars.length && LETTER.test(chars[j]!)) j++;
      if (j === i + 1 && c === "°") {
        out.push({ k: "bad" });
        i++;
        continue;
      }
      out.push({ k: "atom", text: chars.slice(start, j).join("") });
      i = j;
      continue;
    }
    if (c === "^") {
      let j = i + 1;
      while (j < chars.length && /\d/.test(chars[j]!)) j++;
      const digits = chars.slice(i + 1, j).join("");
      out.push(digits === "" ? { k: "bad" } : { k: "pow", n: Number(digits), text: `^${digits}` });
      i = j;
      continue;
    }
    if (SUPERSCRIPT.includes(c)) {
      let j = i;
      let digits = "";
      while (j < chars.length && SUPERSCRIPT.includes(chars[j]!)) {
        digits += String(SUPERSCRIPT.indexOf(chars[j]!));
        j++;
      }
      out.push({ k: "pow", n: Number(digits), text: chars.slice(i, j).join("") });
      i = j;
      continue;
    }
    if (c === "1" && !/\d/.test(chars[i + 1] ?? "")) {
      out.push({ k: "one" });
      i++;
      continue;
    }
    out.push({ k: "bad" });
    i++;
  }
  return out;
}

interface Factor {
  atom: string;
  pow: number;
  text: string;
}

/**
 * Parse the text inside a unit bracket. On failure the message is the one
 * spec §4 prints, including the bracketed text.
 */
export function parseUnit(text: string): UnitParse {
  const t = text.trim();
  const shown = `[${t}]`;
  if (t === "") return fail(`${shown} declares no unit`);
  if (t === "%")
    return fail(`[%] is not a unit — % is number syntax (23% is 0.23); drop the bracket`);

  const toks = tokenize(t);
  if (toks.some((x) => x.k === "bad"))
    return fail(`${shown} is not a unit — an atom is letters only`);

  // a space between two factors, with no product mark, is not a product
  const sig = toks.filter((x) => x.k !== "space");
  for (let i = 0; i + 2 < toks.length; i++) {
    const [a, s, b] = [toks[i]!, toks[i + 1]!, toks[i + 2]!];
    if (s.k === "space" && (a.k === "atom" || a.k === "pow") && b.k === "atom") {
      return fail(`${shown} is not a unit — write a product as ${productSuggestion(toks)}`);
    }
  }

  let i = 0;
  const factor = (): Factor | null => {
    const a = sig[i];
    if (a?.k !== "atom") return null;
    i++;
    let pow = 1;
    let text = a.text;
    const p = sig[i];
    if (p?.k === "pow") {
      pow = p.n;
      text += p.text;
      i++;
    }
    return { atom: SPELLINGS.get(a.text) ?? a.text, pow, text };
  };

  const numerator: Factor[] = [];
  let oneNumerator = false;
  if (sig[0]?.k === "one") {
    oneNumerator = true;
    i = 1;
  } else {
    const f = factor();
    if (!f) return fail(`${shown} is not a unit — an atom is letters only`);
    numerator.push(f);
    while (sig[i]?.k === "mul") {
      i++;
      const g = factor();
      if (!g) return fail(`${shown} is not a unit — an atom is letters only`);
      numerator.push(g);
    }
  }

  const divisors: Factor[] = [];
  while (sig[i]?.k === "div") {
    i++;
    const f = factor();
    if (!f) return fail(`${shown} is not a unit — an atom is letters only`);
    divisors.push(f);
    if (sig[i]?.k === "mul") {
      // `a/b⋅c` reads as a·c/b or as a/(b·c): refuse rather than choose
      const extra: Factor[] = [];
      while (sig[i]?.k === "mul") {
        i++;
        const g = factor();
        if (!g) return fail(`${shown} is not a unit — an atom is letters only`);
        extra.push(g);
      }
      const num = oneNumerator ? ["1"] : numerator.map((x) => x.text);
      const den = divisors.map((x) => x.text);
      const ext = extra.map((x) => x.text);
      const optA =
        [...(oneNumerator ? [] : num), ...ext].join("⋅") + den.map((d) => `/${d}`).join("");
      const optB = num.join("⋅") + [...den, ...ext].map((d) => `/${d}`).join("");
      return fail(`${shown} is ambiguous — write ${optA} or ${optB}`);
    }
  }

  if (i < sig.length) return fail(`${shown} is not a unit — an atom is letters only`);
  if (oneNumerator && divisors.length === 0) return fail(`${shown} declares no unit`);
  if ([...numerator, ...divisors].some((f) => f.pow === 0)) {
    return fail(`${shown} is not a unit — an exponent is a positive integer`);
  }

  let map: UnitMap = DIMENSIONLESS;
  for (const f of numerator) map = mulUnits(map, single(f.atom, f.pow));
  for (const f of divisors) map = divUnits(map, single(f.atom, f.pow));
  if (isDimensionless(map)) return fail(`${shown} declares no unit`);
  return { ok: true, map };
}

function productSuggestion(toks: Tok[]): string {
  let s = "";
  let prevFactor = false;
  for (const x of toks) {
    if (x.k === "space") continue;
    if (x.k === "atom") {
      if (prevFactor) s += "⋅";
      s += x.text;
      prevFactor = true;
    } else if (x.k === "pow") {
      s += x.text;
    } else if (x.k === "mul") {
      s += "⋅";
      prevFactor = false;
    } else if (x.k === "div") {
      s += "/";
      prevFactor = false;
    } else if (x.k === "one") {
      s += "1";
      prevFactor = false;
    }
  }
  return s;
}

function fail(message: string): UnitParse {
  return { ok: false, message };
}

function single(atom: string, pow: number): UnitMap {
  return new Map([[atom, pow]]);
}

function combine(a: UnitMap, b: UnitMap, sign: 1 | -1): UnitMap {
  const out = new Map(a);
  for (const [atom, n] of b) {
    const v = (out.get(atom) ?? 0) + sign * n;
    if (v === 0) out.delete(atom);
    else out.set(atom, v);
  }
  return out;
}

export function mulUnits(a: UnitMap, b: UnitMap): UnitMap {
  return combine(a, b, 1);
}

export function divUnits(a: UnitMap, b: UnitMap): UnitMap {
  return combine(a, b, -1);
}

export function powUnit(a: UnitMap, n: number): UnitMap {
  if (n === 0) return DIMENSIONLESS;
  const out = new Map<string, number>();
  for (const [atom, e] of a) out.set(atom, e * n);
  return out;
}

/** the square root of a map, or null when some exponent is odd */
export function halveUnit(a: UnitMap): UnitMap | null {
  const out = new Map<string, number>();
  for (const [atom, e] of a) {
    if (e % 2 !== 0) return null;
    out.set(atom, e / 2);
  }
  return out;
}

export function isDimensionless(a: UnitMap): boolean {
  return a.size === 0;
}

/** replace every defined atom by its definition, recursively */
export function expandUnit(a: UnitMap, defs: UnitDefs, depth = 0): UnitMap {
  if (defs.size === 0 || depth > 64) return a;
  let out: UnitMap = DIMENSIONLESS;
  for (const [atom, e] of a) {
    const def = defs.get(atom);
    out = mulUnits(out, def ? powUnit(expandUnit(def, defs, depth + 1), e) : single(atom, e));
  }
  return out;
}

export function sameUnit(a: UnitMap, b: UnitMap, defs: UnitDefs): boolean {
  const x = expandUnit(a, defs);
  const y = expandUnit(b, defs);
  if (x.size !== y.size) return false;
  for (const [atom, e] of x) if (y.get(atom) !== e) return false;
  return true;
}

/** Unicode code-point order — no locale, so `USD` sorts before `kg` */
export function compareAtoms(a: string, b: string): number {
  const x = [...a].map((c) => c.codePointAt(0)!);
  const y = [...b].map((c) => c.codePointAt(0)!);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i] !== y[i]) return x[i]! - y[i]!;
  }
  return x.length - y.length;
}

function superscript(n: number): string {
  return n === 1 ? "" : [...String(n)].map((d) => SUPERSCRIPT[Number(d)]).join("");
}

/**
 * The normalised spelling of a map: numerator atoms joined by `⋅`, each divisor
 * after its own `/`, exponents as superscripts, atoms in code-point order,
 * `1/s` for an empty numerator. The empty map prints as the empty string;
 * callers that need a word print `dimensionless`.
 */
export function formatUnit(a: UnitMap): string {
  const atoms = [...a.keys()].sort(compareAtoms);
  const num = atoms.filter((x) => a.get(x)! > 0).map((x) => x + superscript(a.get(x)!));
  const den = atoms.filter((x) => a.get(x)! < 0).map((x) => `/${x}${superscript(-a.get(x)!)}`);
  if (num.length === 0 && den.length === 0) return "";
  return (num.length ? num.join("⋅") : "1") + den.join("");
}

/** `formatUnit`, or the word `dimensionless` for the empty map */
export function showUnitMap(a: UnitMap): string {
  return isDimensionless(a) ? "dimensionless" : formatUnit(a);
}

/** the JSON form: atom → exponent, keys in code-point order */
export function unitJson(a: UnitMap): Record<string, number> {
  const out: Record<string, number> = {};
  for (const atom of [...a.keys()].sort(compareAtoms)) out[atom] = a.get(atom)!;
  return out;
}
