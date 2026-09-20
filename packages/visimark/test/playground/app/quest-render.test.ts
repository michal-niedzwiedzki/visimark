// Follow-up review §2.2 and §2.11: what a bad scenario costs, and what a step
// id is allowed to contain.
//
// `quest-steps.test.ts` next door tests `normalizeStep` against fixtures —
// the schema half. This is the engine half, which is where both findings
// lived: a step `normalizeStep` refuses used to reach `boot().catch` and put
// up the full-page fatal overlay, and a step id containing a quote used to
// throw `SyntaxError` out of `markDone` because the id was interpolated into
// a CSS selector.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { FakeDocument, FakeElement } from "../../support/fake-dom.js";
import { installFakeDom } from "../../support/fake-dom.js";
import type { BadgeBoard } from "../../../src/playground/app/badges.js";
import type { Quest, QuestDeps } from "../../../src/playground/app/quest.js";
import type { Scenarios } from "../../../src/playground/app/types.js";
import { createQuest } from "../../../src/playground/app/quest.js";

/** Every id createQuest() looks up in docs/playground.html. */
const IDS = [
  "scenario-panel",
  "scenario-body",
  "quest-list",
  "quest-complete",
  "reward-box",
  "reward-cta",
  "reward-cta-host",
  "reward-status",
];

const NO_BADGES: BadgeBoard = {
  forFile: () => undefined,
  earned: () => false,
  render: () => {},
  award: () => {},
};

let dom: ReturnType<typeof installFakeDom>;
let doc: FakeDocument;
let reported: string[];

function build(scenarios: Scenarios, overrides: Partial<QuestDeps> = {}): Quest {
  for (const id of IDS) doc.add("div", id);
  const deps: QuestDeps = {
    scenarios,
    scenariosAvailable: true,
    badges: NO_BADGES,
    hasStale: () => false,
    documentText: () => "",
    showAgentPopover: () => {},
    knowledgeText: () => "",
    report: (m) => reported.push(m),
    ...overrides,
  };
  return createQuest(deps);
}

const steps = (): FakeElement[] => (doc.getElementById("quest-list") as FakeElement).children;
const panelText = (): string => (doc.getElementById("scenario-body") as FakeElement).textContent;

beforeEach(() => {
  dom = installFakeDom();
  doc = dom.document;
  reported = [];
});
afterEach(async () => {
  // A completed quest schedules its reveal on a 0 ms timer, and that reveal
  // goes through `revealFadeIn`, which reaches for `requestAnimationFrame`.
  // Let it run while the fake globals are still installed, or it lands in
  // whatever file `bun test` happens to be running next.
  await new Promise((r) => setTimeout(r, 0));
  dom.restore();
});

describe("a scenario whose checklist cannot be loaded", () => {
  const broken: Scenarios = {
    "04-anchors.md": {
      body: "Anchors carry the value and the formula that produced it.",
      // `vibes` is not in the CHECKS vocabulary, which is exactly the thing
      // normalizeStep is there to refuse.
      quest: [{ kind: "eval", text: "t", check: "vibes" }] as never,
    },
  };

  test("costs that chapter's checklist and nothing else", () => {
    const quest = build(broken);
    expect(() => quest.render("04-anchors.md")).not.toThrow();
    expect(steps()).toHaveLength(0);
  });

  test("still shows the scenario the chapter is about", () => {
    build(broken).render("04-anchors.md");
    expect(panelText()).toContain("Anchors carry the value");
    expect((doc.getElementById("scenario-panel") as FakeElement).hidden).toBe(false);
  });

  test("says so in the panel, naming what went wrong", () => {
    build(broken).render("04-anchors.md");
    expect(panelText()).toContain("could not be loaded");
    expect(panelText()).toContain('unknown check "vibes"');
  });

  test("says so in TERMINAL too, the way a missing scenarios.json does", () => {
    build(broken).render("04-anchors.md");
    expect(reported).toHaveLength(1);
    expect(reported[0]).toContain("04-anchors.md");
    expect(reported[0]).toContain("no quest or badge");
  });

  test("the next chapter is unaffected", () => {
    const quest = build({
      ...broken,
      "05-mappers.md": {
        body: "Mappers.",
        quest: [{ kind: "manual", text: "Read it" }],
      },
    });
    quest.render("04-anchors.md");
    quest.render("05-mappers.md");
    expect(steps()).toHaveLength(1);
    expect(reported).toHaveLength(1);
  });
});

describe("a step id containing what a CSS selector cannot take", () => {
  // types.ts documents RawStep["id"] as free-form JSON. It is repo-controlled
  // today and clean, but the contract permits this and the code could not
  // take it.
  const hostile = ['say "hi"', "a]b", "c\\d", "#e.f", ":g"];

  const scenarios: Scenarios = {
    "demo.md": {
      body: "Demo.",
      quest: hostile.map((id) => ({ kind: "manual" as const, id, text: id })),
    },
  };

  test("renders every step", () => {
    build(scenarios).render("demo.md");
    expect(steps().map((li) => li.dataset.id)).toEqual(hostile);
  });

  test("completing one does not throw, and marks the right step", () => {
    build(scenarios).render("demo.md");
    // Manual steps complete on a click, in order.
    for (const [i, id] of hostile.entries()) {
      expect(() => steps()[i]!.click(), id).not.toThrow();
      expect(steps()[i]!.classList.contains("done"), id).toBe(true);
    }
  });

  test("un-completing one finds it again", () => {
    build(scenarios).render("demo.md");
    steps()[0]!.click();
    expect(() => steps()[0]!.click()).not.toThrow();
    expect(steps()[0]!.classList.contains("done")).toBe(false);
  });

  test("an action step with such an id completes on its signal", () => {
    const quest = build({
      "demo.md": {
        body: "Demo.",
        quest: [{ kind: "action", id: 'press "Build"', text: "Press BUILD", action: "act" }],
      },
    });
    quest.render("demo.md");
    expect(() => quest.signal("act")).not.toThrow();
    expect(steps()[0]!.classList.contains("done")).toBe(true);
  });
});

describe("the step elements are rebuilt per quest", () => {
  test("an id reused by the next chapter marks that chapter's step", () => {
    const quest = build({
      "a.md": { body: "A", quest: [{ kind: "manual", id: "same", text: "first" }] },
      "b.md": { body: "B", quest: [{ kind: "manual", id: "same", text: "second" }] },
    });
    quest.render("a.md");
    quest.render("b.md");
    steps()[0]!.click();
    expect(steps()).toHaveLength(1);
    expect(steps()[0]!.textContent).toContain("second");
    expect(steps()[0]!.classList.contains("done")).toBe(true);
  });
});
