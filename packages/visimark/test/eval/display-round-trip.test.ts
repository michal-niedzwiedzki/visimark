import { expect, test } from "bun:test";
import { locate } from "../../src/parse/document.js";
import { roundTrips } from "../../src/eval/display-round-trip.js";

const NBSP = " ";

/** a whole small document, so the re-parse sees a block and a paragraph */
const doc = (line: string) => `# Account\n\n\`\`\`vmark #s\nstatus = "x"\n\`\`\`\n\n${line}\n`;

const proves = (source: string, rendered: string, expected: string) => {
  const anchor = locate(source).anchors[0]!;
  return roundTrips(source, anchor, rendered, expected);
};

test("a strong seed already holding the rendering round-trips", () => {
  expect(
    proves(
      doc("Status **past&nbsp;due**<!--vmark=s.status|nbsp-->."),
      "past&nbsp;due",
      `past${NBSP}due`,
    ),
  ).toBe(true);
});

test("a **_** placeholder spliced with the rendering round-trips", () => {
  expect(
    proves(doc("Status **_**<!--vmark=s.status|nbsp-->."), "past&nbsp;due", `past${NBSP}due`),
  ).toBe(true);
});

test("an *…* seed round-trips", () => {
  expect(
    proves(doc("Status *_*<!--vmark=s.status|nbsp-->."), "past&nbsp;due", `past${NBSP}due`),
  ).toBe(true);
});

test("an intraword underscore inside _…_ round-trips", () => {
  expect(proves(doc("Key _user_id_<!--vmark=s.status|nbsp-->."), "user_id", "user_id")).toBe(true);
});

test("emphasis inside the value does not round-trip", () => {
  expect(
    proves(
      doc("Star **_**<!--vmark=s.status|nbsp-->."),
      "a&nbsp;*b*&nbsp;c",
      `a${NBSP}*b*${NBSP}c`,
    ),
  ).toBe(false);
});

test("a code span inside the value does not round-trip", () => {
  expect(
    proves(
      doc("Tick **_**<!--vmark=s.status|nbsp-->."),
      "run&nbsp;`ls`&nbsp;now",
      `run${NBSP}\`ls\`${NBSP}now`,
    ),
  ).toBe(false);
});

test("entity text in the value decodes to something else and does not round-trip", () => {
  expect(
    proves(
      doc("Joined **_**<!--vmark=s.status|nbsp-->."),
      "already&nbsp;joined",
      "already&nbsp;joined",
    ),
  ).toBe(false);
});

test("an empty rendering never round-trips", () => {
  expect(proves(doc("Empty **_**<!--vmark=s.status|nbsp-->."), "", "")).toBe(false);
});

test("a GFM autolink does not round-trip", () => {
  expect(
    proves(doc("Site **_**<!--vmark=s.status|nbsp-->."), "www.example.com", "www.example.com"),
  ).toBe(false);
});

test("flanking is judged in context: x**…**y breaks where **…** alone does not", () => {
  expect(proves(doc("x**_**<!--vmark=s.status|nbsp-->y"), '"a"', '"a"')).toBe(false);
  expect(proves(doc("Quote **_**<!--vmark=s.status|nbsp-->."), '"a"', '"a"')).toBe(true);
});

test("a reference definition elsewhere in the document turns [foo] into a link", () => {
  const src = doc("Ref **_**<!--vmark=s.status|nbsp-->.") + "\n[foo]: https://example.com\n";
  expect(proves(src, "[foo]", "[foo]")).toBe(false);
});

test("the flanking seed is a strong node before the splice", () => {
  expect(locate(doc("x**_**<!--vmark=s.status|nbsp-->y")).anchors[0]!.value!.kind).toBe("strong");
});
