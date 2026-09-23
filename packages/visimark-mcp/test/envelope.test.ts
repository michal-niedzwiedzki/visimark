import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyze, build, check, locate, onDisk } from "visimark";
import {
  CONTENT_SOURCE,
  envelope,
  findingSummary,
  findings,
  skipped,
  statusOf,
} from "../src/envelope.js";
import { engineVersion, serverVersion } from "../src/version.js";

const repo = join(import.meta.dir, "../../..");
const clean = join(repo, "docs/example-invoice.md");
const drift = join(repo, "docs/example-invoice-drift.md");
const imported = join(repo, "docs/example-invoice-csv-import.md");
const charts = join(repo, "docs/example-charts.md");

function onDiskRun(path: string) {
  return check(build(locate(readFileSync(path, "utf8"))), { doc: onDisk(path) });
}

test("the envelope's field order is command, visimark, status, then the body", () => {
  const r = analyze(readFileSync(clean, "utf8")).result;
  const keys = Object.keys(envelope("check", { findings: [] }, r.findings));
  expect(keys).toEqual(["command", "visimark", "status", "findings"]);
});

test("status tracks the exit code the CLI would have produced", () => {
  expect(statusOf(onDiskRun(clean).findings)).toBe("ok");
  expect(statusOf(onDiskRun(drift).findings)).toBe("problems");
});

test("advisory findings never turn ok into problems", () => {
  // The split is `isProblem()` in the engine, reused rather than
  // reimplemented — the point review made on #152.
  const advice = [
    { code: "NOTE", message: "x" },
    { code: "WARN", message: "y" },
  ] as never;
  expect(statusOf(advice)).toBe("ok");
});

test("document values stay decimal strings, never JSON numbers", () => {
  // A JSON number here is the §7 violation the envelope spec exists to
  // prevent: 3120.00 is not 3120, and the trailing zeros are the precision the
  // document declared. Round-tripped through JSON so the assertion is about
  // the wire, not about what the object held before serialisation.
  const wire = JSON.parse(JSON.stringify(findings(drift, onDiskRun(drift)))) as {
    code: string;
    location: { name?: string; row?: string };
    details: Record<string, unknown>;
  }[];
  const net = wire.find(
    (f) => f.code === "STALE" && f.location.name === "Net" && f.location.row === "On-call support",
  );
  expect(net?.details).toEqual({ stored: "3120.00", computed: "5200.00", formula: "Qty * Rate" });
  expect(typeof net?.details.stored).toBe("string");
});

test("the summary is the one the CLI reports for the same document", () => {
  // 26 problems over 20 findings: an anchor group counts its suppressed rows.
  // Re-deriving that arithmetic here rather than reusing `findingSummary`
  // would be the second serialisation the envelope spec forbids.
  expect(findingSummary(onDiskRun(drift).findings)).toEqual({
    problems: 26,
    stale: 21,
    errors: 5,
  });
});

test("a document with no path is located as <content>", () => {
  const source = readFileSync(drift, "utf8");
  const pub = findings(undefined, analyze(source).result) as {
    location: { file: string };
  }[];
  expect(pub[0]?.location.file).toBe(CONTENT_SOURCE);
});

test("skipped is {} when there was nothing to skip", () => {
  expect(skipped(onDiskRun(clean))).toEqual({});
});

test("content mode names the import it could not verify instead of reporting it", () => {
  // The same document, both ways. Under `path` the import resolves and the
  // engine has something to say about it; under `content` there is no reader,
  // so the phase stands down and `skipped.imports` names the sheet. An agent
  // that saw the finding vanish with no explanation would read it as a bug.
  const source = readFileSync(imported, "utf8");
  const viaContent = analyze(source).result;
  const viaPath = onDiskRun(imported);

  expect(skipped(viaContent).imports).toEqual(["lines"]);
  expect(skipped(viaPath).imports).toBeUndefined();

  const codes = (r: typeof viaPath) => r.findings.map((f) => f.code);
  expect(codes(viaContent)).not.toContain("IMPORT");
});

test("content mode names the charts it could not verify", () => {
  const viaContent = analyze(readFileSync(charts, "utf8")).result;
  expect(skipped(viaContent).charts?.length).toBeGreaterThan(0);
  expect(skipped(viaContent).charts?.every((c) => c.includes("."))).toBe(true);
});

test("the engine version and the server version are read apart", () => {
  // Spec §3.3: the envelope carries the engine version, `serverInfo` carries
  // the server's. They are in lockstep by policy, not by being one field.
  expect(engineVersion()).toMatch(/^\d+\.\d+\.\d+$/);
  expect(serverVersion()).toMatch(/^\d+\.\d+\.\d+$/);
});
