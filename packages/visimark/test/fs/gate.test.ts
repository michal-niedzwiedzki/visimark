import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveArtifactPath } from "../../src/artifact/path.js";
import { resolveImportPath } from "../../src/import/path.js";

/**
 * Every rule is asserted against **both** gates from one table.
 *
 * The two gates used to be separate copies, and the read side had a single
 * indirect assertion against the write side's nine. That asymmetry is the
 * failure mode the shared gate exists to prevent, so the tests are shared too:
 * a rule that stops holding for one noun fails here for both.
 */

const dir = mkdtempSync(join(tmpdir(), "vmark-gate-"));
const doc = join(dir, "report.md");
writeFileSync(doc, "# x\n");

/** the two faces of `gatePath`, named by the noun each one reports */
const gates = [
  { noun: "artifact path", ext: ".svg", resolve: resolveArtifactPath },
  { noun: "imported file path", ext: ".csv", resolve: resolveImportPath },
] as const;

type Gate = (typeof gates)[number];

function err(gate: Gate, url: string): string {
  const r = gate.resolve(doc, url);
  if ("ok" in r) throw new Error(`${gate.noun}: expected refusal for ${url}, got ${r.ok}`);
  return r.err;
}

function ok(gate: Gate, url: string): string {
  const r = gate.resolve(doc, url);
  if ("err" in r) throw new Error(`${gate.noun}: expected acceptance for ${url}, got ${r.err}`);
  return r.ok;
}

/** a refusal named by the suffix its message carries after the noun */
const refusals: { name: string; url: (g: Gate) => string; tail: (g: Gate) => string }[] = [
  {
    name: "an empty path",
    url: () => "",
    tail: () => " is empty",
  },
  {
    name: "a NUL byte",
    url: (g) => `a\u0000b${g.ext}`,
    tail: () => " contains a control character",
  },
  {
    name: "a DEL byte",
    url: (g) => `a\u007fb${g.ext}`,
    tail: () => " contains a control character",
  },
  {
    name: "a drive letter",
    url: (g) => `C:\\windows\\x${g.ext}`,
    tail: () => " must be relative, not a drive letter",
  },
  {
    name: "a URL",
    url: (g) => `https://example.com/x${g.ext}`,
    tail: () => " must be a relative path, not a URL",
  },
  {
    name: "a data URI",
    url: (g) => `data:text/plain,x${g.ext}`,
    tail: () => " must be a relative path, not a URL",
  },
  {
    name: "an absolute path",
    url: (g) => `/etc/x${g.ext}`,
    tail: () => " must be relative",
  },
  {
    name: "a UNC path",
    url: (g) => `\\\\server\\share\\x${g.ext}`,
    tail: () => " must be relative",
  },
  {
    name: "the wrong extension",
    url: () => "x.md",
    tail: (g) => ` must end in \`${g.ext}\``,
  },
  {
    name: "an uppercase extension",
    url: (g) => `x${g.ext.toUpperCase()}`,
    tail: (g) => ` must end in \`${g.ext}\``,
  },
  {
    name: "no extension at all",
    url: () => "x",
    tail: (g) => ` must end in \`${g.ext}\``,
  },
  {
    name: "a reserved device name",
    url: (g) => `CON${g.ext}`,
    tail: () => " uses a reserved device name `CON",
  },
  {
    name: "a reserved device name in a subdirectory",
    url: (g) => `sub/com1${g.ext}`,
    tail: () => " uses a reserved device name `com1",
  },
  {
    name: "traversal above the document",
    url: (g) => `../x${g.ext}`,
    tail: () => " escapes the document's directory",
  },
  {
    name: "traversal that climbs out and back",
    url: (g) => `sub/../../x${g.ext}`,
    tail: () => " escapes the document's directory",
  },
];

for (const gate of gates) {
  for (const rule of refusals) {
    test(`${gate.noun}: ${rule.name} is refused`, () => {
      const message = err(gate, rule.url(gate));
      // the noun is what differs between the gates; the rest must be identical
      expect(message.startsWith(gate.noun)).toBe(true);
      expect(message.slice(gate.noun.length)).toStartWith(rule.tail(gate));
    });
  }

  test(`${gate.noun}: a plain relative file beside the document is accepted`, () => {
    expect(ok(gate, `x${gate.ext}`)).toBe(join(dir, `x${gate.ext}`));
  });

  test(`${gate.noun}: a subdirectory under the document's directory is accepted`, () => {
    expect(ok(gate, `sub/a/b${gate.ext}`)).toBe(join(dir, `sub/a/b${gate.ext}`));
  });

  test(`${gate.noun}: traversal that stays inside is accepted`, () => {
    expect(ok(gate, `sub/../x${gate.ext}`)).toBe(join(dir, `x${gate.ext}`));
  });

  test(`${gate.noun}: a symlinked parent leaving the directory is refused`, () => {
    const outside = mkdtempSync(join(tmpdir(), "vmark-gate-out-"));
    const link = join(dir, `escape-${gate.ext.slice(1)}`);
    mkdirSync(join(dir, "sub"), { recursive: true });
    try {
      symlinkSync(outside, link, "dir");
    } catch {
      return; // no symlink permission on this platform
    }
    expect(err(gate, `escape-${gate.ext.slice(1)}/x${gate.ext}`)).toBe(
      `${gate.noun} resolves through a symlink out of the document's directory`,
    );
  });
}

test("the drive-letter rule is judged before the URL-scheme rule", () => {
  // `C:` also matches the scheme regex, so the order decides which message a
  // Windows path gets. Both gates must agree, and both must say drive letter.
  for (const gate of gates) {
    expect(err(gate, `C:x${gate.ext}`)).toBe(`${gate.noun} must be relative, not a drive letter`);
  }
});
