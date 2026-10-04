// Follow-up review §2.2, the half that is not a decision.
//
// docs/playground/scenarios.json is data a chapter author edits without
// touching code, and it has a schema — `RawStep` in types.ts — which is
// executable, in `normalizeQuest`. Nothing ran it over the real file.
// `quest-steps.test.ts` tests the function against fixtures; the data file
// itself was validated only in a visitor's browser, where the cost of being
// wrong used to be a dead page and is now a missing checklist.
//
// This passes at the commit that added it — 87 step ids, 13 badges, all valid.
// It is worth having precisely *because* it passes: it converts a class of
// runtime failure into a CI failure before anyone writes chapter 14.
//
// It lives under test/playground/app/ because that is the program with the DOM
// lib — the one that may import from src/playground/app/ at all.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RawBadge, RawScenario } from "../../../src/playground/app/types.js";
import { BADGE_ICON_NAMES } from "../../../src/playground/app/badges.js";
import { normalizeQuest } from "../../../src/playground/app/quest.js";
import { FILE_SOURCES, TUTORIAL_CHAPTERS } from "../../../src/playground/app/sources.js";

const raw = JSON.parse(
  readFileSync(join(import.meta.dir, "../../../../../docs/playground/scenarios.json"), "utf8"),
) as Record<string, RawScenario | string>;

const manifest = Object.fromEntries(
  Object.entries(
    JSON.parse(
      readFileSync(join(import.meta.dir, "../../../../../docs/playground/badges.json"), "utf8"),
    ) as Record<string, RawBadge | string>,
  ).filter(([slug]) => slug !== "//"),
) as Record<string, RawBadge>;

// "//" is the file's own documentation comment, not a scenario — the same
// exclusion loadScenarios() makes.
const names = Object.keys(raw).filter((n) => n !== "//");
const scenario = (name: string): RawScenario => raw[name] as RawScenario;

describe("every scenario in docs/playground/scenarios.json", () => {
  test("has at least one, so this file is testing something", () => {
    expect(names.length).toBeGreaterThan(0);
  });

  test("names a document the playground can actually open", () => {
    for (const name of names) {
      expect(Object.keys(FILE_SOURCES), `${name} has no entry in FILE_SOURCES`).toContain(name);
    }
  });

  test("has a body, since the panel renders one", () => {
    for (const name of names) {
      expect(typeof scenario(name).body, name).toBe("string");
      expect(scenario(name).body.length, name).toBeGreaterThan(0);
    }
  });

  test("has a quest that normalizes", () => {
    // The thing that used to be checked in the visitor's browser.
    for (const name of names) {
      expect(() => normalizeQuest(scenario(name).quest), name).not.toThrow();
    }
  });

  test("has unique step ids within its own quest", () => {
    // Ids are only unique per quest, and `state.done` is keyed by them — two
    // steps sharing one would complete and un-complete together.
    for (const name of names) {
      const ids = normalizeQuest(scenario(name).quest).map((s) => s.id);
      expect(new Set(ids).size, `${name} repeats a step id`).toBe(ids.length);
    }
  });

  test("names a badge that is in the manifest, when it carries one", () => {
    for (const name of names) {
      const slug = scenario(name).badge;
      if (slug === undefined) continue;
      expect(typeof slug, `${name}: badge is a slug, not an inline object`).toBe("string");
      expect(Object.keys(manifest), `${name}: unknown badge "${slug}"`).toContain(slug);
    }
  });

  test("carries a link with a link reward, and a prompt with an agent one", () => {
    for (const name of names) {
      const reward = scenario(name).reward;
      if (!reward) continue;
      expect(["link", "gist", "agent"], `${name}: unknown reward kind`).toContain(reward.kind);
      if (reward.kind === "link") expect(reward.link, name).toBeTruthy();
      if (reward.kind === "agent") expect(reward.prompt, name).toContain("{json}");
    }
  });
});

describe("the tutorial track", () => {
  test("has a scenario for every chapter", () => {
    for (const chapter of TUTORIAL_CHAPTERS) {
      expect(names, `${chapter} has no scenario`).toContain(chapter);
    }
  });

  test("has a badge for every chapter", () => {
    // createBadgeBoard()'s own comment: "there should be none among
    // TUTORIAL_CHAPTERS" without one.
    for (const chapter of TUTORIAL_CHAPTERS) {
      expect(scenario(chapter)?.badge, `${chapter} has no badge`).toBeDefined();
    }
  });

  test("gives each chapter a distinct badge", () => {
    const slugs = TUTORIAL_CHAPTERS.map((c) => scenario(c).badge);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("every badge in docs/playground/badges.json", () => {
  const entries = Object.entries(manifest);

  test("names an icon that exists", () => {
    // `BADGE_ICONS[badge.icon] ?? ""` renders nothing rather than failing, so
    // a typo here is invisible until someone earns the badge.
    for (const [slug, badge] of entries) {
      expect(BADGE_ICON_NAMES, `${slug}: unknown icon "${badge.icon}"`).toContain(badge.icon);
      expect(badge.name, slug).toBeTruthy();
      expect(badge.skill, slug).toBeTruthy();
    }
  });

  test("has a distinct name, and a slug that is a kebab-case word list", () => {
    expect(new Set(entries.map(([, b]) => b.name)).size).toBe(entries.length);
    for (const [slug] of entries) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  test("links to the chapter whose scenario awards it", () => {
    for (const [slug, badge] of entries) {
      expect(scenario(badge.file)?.badge, `${slug}: ${badge.file} does not award it`).toBe(slug);
    }
  });

  test("is used by a chapter, so the BADGES tab cannot show one nobody can earn", () => {
    const used = new Set(names.map((n) => scenario(n).badge));
    for (const [slug] of entries) expect(used.has(slug), `${slug} is unused`).toBe(true);
  });
});
