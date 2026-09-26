import { MarkdownView, PluginSettingTab, Setting, type App } from "obsidian";
import { editorViewOf, forceLivePreviewRecompute } from "./live-preview.js";
import type VisiMarkPlugin from "./main.js";

/**
 * Spec §2.5's three real toggles — `writeChartArtifacts` is fixed, not a
 * setting (see `settings.ts`).
 */
export class VisiMarkSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: VisiMarkPlugin,
  ) {
    super(app, plugin);
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Format on explicit save")
      .setDesc(
        "Apply every repair fmt would make — the same plan the Format command runs — when you press " +
          "Ctrl/Cmd+S with a VisiMark note focused. An autosave never triggers this. Saving another way, " +
          "such as the command palette's “Save file,” does not either: Obsidian has no event for " +
          "an explicit save distinct from autosave, so this listens for the keystroke specifically.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.formatOnSave).onChange(async (value) => {
          this.plugin.settings.formatOnSave = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Show provenance in Live Preview")
      .setDesc(
        "Mark a computed value while you type, the same way reading mode always does. Turn off if the " +
          "anchor comment behind a mark reads badly as literal text next to it.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showProvenanceInLivePreview)
          .onChange(async (value) => {
            this.plugin.settings.showProvenanceInLivePreview = value;
            await this.plugin.saveSettings();
            // Review row 17: a setting flip is not a document change or a
            // mode switch, so `livePreviewMarks`'s own extension would
            // otherwise leave every open editor showing the old marks (or
            // none) until its next keystroke. Dispatching straight to each
            // one's CodeMirror instance makes it immediate.
            this.app.workspace.iterateAllLeaves((leaf) => {
              if (!(leaf.view instanceof MarkdownView)) return;
              const cm = editorViewOf(leaf.view.editor);
              cm?.dispatch({ effects: forceLivePreviewRecompute.of(undefined) });
            });
          }),
      );

    new Setting(containerEl)
      .setName("Sweep the vault on open")
      .setDesc(
        "Start a vault-wide check automatically each time this vault opens, and keep a live count " +
          "next to the ribbon icon updated as you edit (v1.1 row 13) — turning this on here starts " +
          "that count for the rest of this session too, without waiting for the next open.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.sweepOnOpen).onChange(async (value) => {
          this.plugin.settings.sweepOnOpen = value;
          await this.plugin.saveSettings();
          // turning this on later in the same session should not require a
          // restart to see the badge — turning it off does not stop an
          // index already running (`startAmbientIndex`'s own doc comment)
          if (value) void this.plugin.startAmbientIndex();
        }),
      );

    new Setting(containerEl)
      .setName("Write chart artifacts")
      .setDesc(
        "Let Format (the command, or format-on-save) regenerate a stale or missing chart's SVG in " +
          "the vault. Off by default: this plugin has never created a new file in your vault before, " +
          "and this is the first setting that lets it. With this off, a stale chart still gets a " +
          "finding — it just never gets rewritten for you.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.writeChartArtifacts).onChange(async (value) => {
          this.plugin.settings.writeChartArtifacts = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Fix unambiguous dates")
      .setDesc(
        "Let Format also rewrite a date it can read but that is not in ISO form — the same thing " +
          "the CLI's fmt --fix-dates does. Off by default, same as that flag. A date VisiMark cannot " +
          "read at all (an ambiguous one such as 03/04/2026) still needs a person either way.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.fixDatesOnFormat).onChange(async (value) => {
          this.plugin.settings.fixDatesOnFormat = value;
          await this.plugin.saveSettings();
        }),
      );
  }
}
