import { beforeEach, expect, test } from "bun:test";
import { registerCommands } from "../src/commands.js";
import { registerSettings } from "../src/settings.js";
import { installFakeJoplin, type FakeJoplin } from "./fake-joplin.js";

let fake: FakeJoplin;
beforeEach(async () => {
  fake = installFakeJoplin();
  await registerSettings();
  await registerCommands();
});

test("M-3.1: a VisiMark section with the two settings, labels and defaults of spec §2.4", () => {
  expect(fake.sections).toEqual([{ name: "visimark", label: "VisiMark" }]);
  expect(fake.registered).toEqual({
    showMarks: {
      value: true,
      type: 3,
      section: "visimark",
      public: true,
      label: "Show marks on computed values",
    },
    fixDatesOnFormat: {
      value: false,
      type: 3,
      section: "visimark",
      public: true,
      label: "When formatting, rewrite dates to ISO 8601 where the date is unambiguous",
    },
  });
});

test("the editor's request for settings is answered with showMarks", async () => {
  fake.pluginSettings.showMarks = false;
  expect(await fake.onMessage["visimark-codemirror"]!({ kind: "settings" })).toEqual({
    showMarks: false,
  });
  expect(await fake.onMessage["visimark-codemirror"]!({ kind: "other" })).toBeUndefined();
});

test("a showMarks change is pushed to the editor; other changes are not", async () => {
  fake.editor["visimark.cm.setMarks"] = { kind: "ok" };
  fake.pluginSettings.showMarks = false;
  await fake.onSettingsChange!({ keys: ["showMarks"] });
  expect(fake.editorCalls).toEqual([{ name: "visimark.cm.setMarks", args: [{ show: false }] }]);
  await fake.onSettingsChange!({ keys: ["fixDatesOnFormat"] });
  expect(fake.editorCalls).toHaveLength(1);
  expect(fake.messages).toEqual([]);
});

test("Format passes fixDatesOnFormat through", async () => {
  fake.editor["visimark.cm.format"] = { kind: "clean", importsDropped: false };
  fake.pluginSettings.fixDatesOnFormat = true;
  await fake.run("visimark.format");
  expect(fake.editorCalls).toEqual([{ name: "visimark.cm.format", args: [{ fixDates: true }] }]);
});
